import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
  verifyPasswordConstantTime,
} from "@/server/auth/password";
import { GENERIC_LOGIN_ERROR_MESSAGE } from "@/server/auth/credentials";
import {
  SESSION_MAX_AGE_SECONDS,
  getSessionCookieOptions,
  resolveAuthSecret,
} from "@/server/auth/config";
import { verifySameOrigin } from "@/server/security/origin-check";
import { assertRateLimit, checkRateLimit, resetRateLimitStore } from "@/server/security/rate-limit";
import { formatStructuredLog, hashEmailForLog } from "@/server/security/logger";
import { createUserSchema, loginSchema } from "@/lib/validation/auth";
import { toErrorResponse } from "@/lib/errors";

function collectRouteFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name === "route.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

describe("M2 Security & Auth Unit Suite (TC-X01, TC-X02, TC-X03, TC-X06, TC-X07)", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("TC-X01 (SEC-01): hashes passwords with argon2id, rejects weak/short passwords, and redacts PII/secrets from logs", async () => {
    expect(() => validatePasswordStrength("Short123!")).toThrow(/12 characters/i);
    expect(() => validatePasswordStrength("password123456")).toThrow(/too common/i);
    expect(() => validatePasswordStrength("aaaaaaaaaaaa")).toThrow(/predictable/i);

    const strongPlain = "SagaraStrongPass!2026";
    const hash = await hashPassword(strongPlain);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain(strongPlain);
    expect(await verifyPassword(hash, strongPlain)).toBe(true);
    expect(await verifyPassword(hash, "WrongPassword!2026")).toBe(false);

    // Structured logger must never output plaintext passwords or guest PII (SEC-01, SEC-18)
    const serialized = formatStructuredLog({
      level: "info",
      event: "auth.login_attempt",
      requestId: "req-123",
      meta: {
        email: "guest@example.com",
        password: strongPlain,
        phone: "+628123456789",
        specialRequests: "Late check-in",
        emailHash: hashEmailForLog("guest@example.com"),
      },
    });

    expect(serialized).not.toContain(strongPlain);
    expect(serialized).not.toContain("guest@example.com");
    expect(serialized).not.toContain("+628123456789");
    expect(serialized).not.toContain("Late check-in");
    expect(serialized).toContain('"requestId":"req-123"');
  });

  it("TC-X02 (SEC-02): executes constant-time argon2id verification even when user does not exist", async () => {
    const unknownUserResult = await verifyPasswordConstantTime(null, "CandidatePassword!2026");
    expect(unknownUserResult).toBe(false);
    expect(GENERIC_LOGIN_ERROR_MESSAGE).toBe("Email or password is incorrect.");
  });

  it("TC-X03 (SEC-03, SEC-14): enforces HttpOnly, SameSite=Lax, 8h maxAge, Secure in prod, and strong AUTH_SECRET in prod", () => {
    const devCookies = getSessionCookieOptions("development");
    expect(devCookies).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 28800,
    });
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);

    const prodCookies = getSessionCookieOptions("production");
    expect(prodCookies).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 28800,
    });

    expect(() => resolveAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "" })).toThrow(/SEC-14/i);
    expect(() =>
      resolveAuthSecret({
        NODE_ENV: "production",
        AUTH_SECRET: "replace-with-openssl-rand-base64-32",
      }),
    ).toThrow(/SEC-14/i);
    expect(
      resolveAuthSecret({
        NODE_ENV: "production",
        AUTH_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef",
      }),
    ).toBe("0123456789abcdef0123456789abcdef0123456789abcdef");
  });

  it("TC-X04 (SEC-04): rate limiter blocks after maxAttempts and returns 429 with Retry-After header", async () => {
    const baseTime = 1_700_000_000_000;

    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit({
        key: "ip:203.0.113.10",
        limit: 5,
        windowMs: 15 * 60 * 1000,
        nowMs: baseTime + i * 100,
      });
      expect(res.allowed).toBe(true);
    }

    const sixth = checkRateLimit({
      key: "ip:203.0.113.10",
      limit: 5,
      windowMs: 15 * 60 * 1000,
      nowMs: baseTime + 1000,
    });
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(800);

    let caughtError: unknown;
    try {
      assertRateLimit({
        key: "ip:203.0.113.10",
        limit: 5,
        windowMs: 15 * 60 * 1000,
        nowMs: baseTime + 1000,
      });
    } catch (err) {
      caughtError = err;
    }

    const response = toErrorResponse(caughtError, {
      requestId: "req-rate-limit",
      isAdminRoute: true,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const payload = await response.json();
    expect(payload.error.code).toBe("RATE_LIMITED");
    expect(payload.error.requestId).toBe("req-rate-limit");
  });

  it("TC-X06 (SEC-05): meta-test verifies every route.ts under src/app/api/admin/** imports and invokes requireRole", () => {
    const adminApiDir = path.resolve(process.cwd(), "src/app/api/admin");
    const routeFiles = collectRouteFiles(adminApiDir);

    expect(routeFiles.length).toBeGreaterThanOrEqual(2);

    for (const filePath of routeFiles) {
      const content = fs.readFileSync(filePath, "utf8");
      const relativePath = path.relative(process.cwd(), filePath);
      expect(content, `${relativePath} must import requireRole`).toMatch(
        /import\s+\{[^}]*\brequireRole\b[^}]*\}\s+from\s+["']@\/server\/auth\/require-role["']/,
      );
      expect(content, `${relativePath} must call requireRole(...)`).toMatch(
        /\bawait\s+requireRole\s*\(/,
      );
    }
  });

  it("TC-X07 (SEC-06): verifySameOrigin allows same-origin requests and rejects cross-origin or missing-origin state-changing requests", () => {
    const sameOriginReq = new Request("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Sec-Fetch-Site": "same-origin",
      },
    });
    expect(() => verifySameOrigin(sameOriginReq)).not.toThrow();

    const evilOriginReq = new Request("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: {
        Origin: "https://evil.example.com",
      },
    });
    expect(() => verifySameOrigin(evilOriginReq)).toThrow(/Origin verification failed/i);

    const crossSiteFetchReq = new Request("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Sec-Fetch-Site": "cross-site",
      },
    });
    expect(() => verifySameOrigin(crossSiteFetchReq)).toThrow(/Cross-site/i);

    const missingOriginReq = new Request("http://localhost:3000/api/admin/users", {
      method: "POST",
    });
    expect(() => verifySameOrigin(missingOriginReq)).toThrow(/Origin verification failed/i);
  });

  it("SEC-07: strict Zod auth schemas reject unknown fields", () => {
    expect(() =>
      loginSchema.parse({
        email: "admin@sagaravillas.example.com",
        password: "SagaraAdminPass!2026",
        isAdmin: true,
      }),
    ).toThrow();

    expect(() =>
      createUserSchema.parse({
        email: "newstaff@sagaravillas.example.com",
        name: "New Staff",
        role: "STAFF",
        password: "SagaraStaffPass!2026",
        passwordHash: "injected",
      }),
    ).toThrow();
  });
});
