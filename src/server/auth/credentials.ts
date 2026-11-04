import type { PrismaClient, UserRole } from "@prisma/client";
import { loginSchema } from "../../lib/validation/auth";
import { hashEmailForLog, logSecurityEvent } from "../security/logger";
import { checkRateLimit } from "../security/rate-limit";
import { verifyPasswordConstantTime } from "./password";

export const GENERIC_LOGIN_ERROR_MESSAGE = "Email or password is incorrect.";
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes (SEC-04)
export const LOGIN_IP_RATE_LIMIT = {
  limit: 15,
  windowMs: 15 * 60 * 1000,
};

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type LoginResult =
  | { ok: true; user: AuthenticatedUser }
  | {
      ok: false;
      error: string;
      code: "INVALID_CREDENTIALS" | "RATE_LIMITED";
      retryAfterSeconds?: number;
    };

export interface AuthenticateOptions {
  now?: Date;
  clientIp?: string;
  skipIpRateLimit?: boolean;
}

/**
 * Authenticates a user by email and password with:
 * - SEC-01 argon2id verification
 * - SEC-02 generic error message & constant-time dummy verification for unknown email
 * - SEC-04 5-failure 15-minute lockout (`failedLoginCount`, `lockedUntil`) + IP rate limit
 * - SEC-17 transactional AuditLog on lockout / login
 * - SEC-18 structured log with hashed email (no plaintext email or password)
 */
export async function authenticateWithCredentials(
  prisma: PrismaClient,
  rawInput: unknown,
  options: AuthenticateOptions = {},
): Promise<LoginResult> {
  const now = options.now ?? new Date();

  if (!options.skipIpRateLimit && options.clientIp) {
    const rate = checkRateLimit({
      key: `login:ip:${options.clientIp}`,
      limit: LOGIN_IP_RATE_LIMIT.limit,
      windowMs: LOGIN_IP_RATE_LIMIT.windowMs,
      nowMs: now.getTime(),
    });
    if (!rate.allowed) {
      logSecurityEvent({
        level: "warn",
        event: "auth.login_rate_limited",
        meta: { retryAfterSeconds: rate.retryAfterSeconds },
      });
      return {
        ok: false,
        error: GENERIC_LOGIN_ERROR_MESSAGE,
        code: "RATE_LIMITED",
        retryAfterSeconds: rate.retryAfterSeconds,
      };
    }
  }

  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) {
    await verifyPasswordConstantTime(null, "invalid-input-dummy-password");
    return {
      ok: false,
      error: GENERIC_LOGIN_ERROR_MESSAGE,
      code: "INVALID_CREDENTIALS",
    };
  }

  const emailNormalized = parsed.data.email.trim().toLowerCase();
  const emailHash = hashEmailForLog(emailNormalized);

  const user = await prisma.user.findUnique({
    where: { email: emailNormalized },
  });

  // Always run argon2 verification even if user does not exist or is locked (SEC-02)
  const passwordMatches = await verifyPasswordConstantTime(
    user?.passwordHash,
    parsed.data.password,
  );

  if (!user || !user.isActive) {
    logSecurityEvent({
      level: "warn",
      event: "auth.login_failed",
      meta: { emailHash, reason: !user ? "unknown_account" : "inactive_account" },
    });
    return {
      ok: false,
      error: GENERIC_LOGIN_ERROR_MESSAGE,
      code: "INVALID_CREDENTIALS",
    };
  }

  // SEC-04 / TC-X04: If currently locked, reject even if password is correct
  if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
    logSecurityEvent({
      level: "warn",
      event: "auth.login_blocked_locked",
      meta: { emailHash },
    });
    return {
      ok: false,
      error: GENERIC_LOGIN_ERROR_MESSAGE,
      code: "INVALID_CREDENTIALS",
    };
  }

  if (!passwordMatches) {
    const lockExpired = user.lockedUntil !== null && user.lockedUntil.getTime() <= now.getTime();
    const baseFailures = lockExpired ? 0 : user.failedLoginCount;
    const nextFailures = baseFailures + 1;
    const shouldLock = nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS;
    const nextLockedUntil = shouldLock ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: nextFailures,
          lockedUntil: nextLockedUntil,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: shouldLock ? "auth.account_locked" : "auth.login_failed",
          entityType: "User",
          entityId: user.id,
          metadata: {
            failedLoginCount: nextFailures,
            locked: shouldLock,
          },
        },
      });
    });

    logSecurityEvent({
      level: "warn",
      event: shouldLock ? "auth.account_locked" : "auth.login_failed",
      meta: { emailHash, failedLoginCount: nextFailures },
    });

    return {
      ok: false,
      error: GENERIC_LOGIN_ERROR_MESSAGE,
      code: "INVALID_CREDENTIALS",
    };
  }

  // Password matched and account is not locked -> reset failure counters and record login
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "auth.login_success",
        entityType: "User",
        entityId: user.id,
        metadata: { role: user.role },
      },
    });
  });

  logSecurityEvent({
    level: "info",
    event: "auth.login_success",
    meta: { emailHash, role: user.role },
  });

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}
