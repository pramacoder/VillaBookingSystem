import type { PrismaClient, UserRole } from "@prisma/client";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { logSecurityEvent } from "@/server/security/logger";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface RequireRoleOptions {
  session?: Session | null;
  prisma?: PrismaClient;
  now?: Date;
}

/**
 * Server-side authorization guard required at the start of every admin handler/action (SEC-05).
 * Also re-verifies in PostgreSQL that the user account is still active and unlocked (SEC-03).
 */
export async function requireRole(
  allowedRoles: readonly UserRole[],
  options: RequireRoleOptions = {},
): Promise<AuthenticatedUser> {
  const session = options.session !== undefined ? options.session : await auth();

  const sessionUserId = session?.user?.id;
  if (!session || !sessionUserId) {
    throw new UnauthenticatedError();
  }

  const prisma = options.prisma ?? db;
  const now = options.now ?? new Date();

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lockedUntil: true,
    },
  });

  if (!user || !user.isActive) {
    logSecurityEvent({
      level: "warn",
      event: "auth.session_rejected_inactive",
      meta: { userId: sessionUserId },
    });
    throw new UnauthenticatedError();
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
    logSecurityEvent({
      level: "warn",
      event: "auth.session_rejected_locked",
      meta: {
        userId: user.id,
        lockedUntil: user.lockedUntil.toISOString(),
      },
    });
    throw new UnauthenticatedError();
  }

  if (!allowedRoles.includes(user.role)) {
    logSecurityEvent({
      level: "warn",
      event: "auth.forbidden_role",
      meta: {
        userId: user.id,
        role: user.role,
        allowedRoles: [...allowedRoles],
      },
    });
    throw new ForbiddenError();
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * Server Component page guard for `/admin/**` layouts and pages.
 * Redirects anonymous users to `/admin/login` and unauthorized roles to `/admin?forbidden=1`.
 */
export async function requirePageRole(
  allowedRoles: readonly UserRole[],
  options: RequireRoleOptions = {},
): Promise<AuthenticatedUser> {
  try {
    return await requireRole(allowedRoles, options);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/admin/login");
    }
    if (err instanceof ForbiddenError) {
      redirect("/admin?forbidden=1");
    }
    throw err;
  }
}
