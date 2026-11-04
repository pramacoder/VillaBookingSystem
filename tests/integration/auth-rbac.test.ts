import { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateWithCredentials } from "@/server/auth/credentials";
import { hashPassword } from "@/server/auth/password";
import { requireRole } from "@/server/auth/require-role";

const currentTestSession = vi.hoisted(() => {
  const defaultLocalDbUrl =
    "postgresql://sagara:sagara_local_dev@localhost:5433/sagara_villas?schema=public";
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = defaultLocalDbUrl;
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  return {
    value: null as Session | null,
  };
});

vi.mock("@/server/auth", () => ({
  auth: async () => currentTestSession.value,
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { GET as getAdminMe } from "@/app/api/admin/me/route";
import { GET as getAdminUsers, POST as postAdminUsers } from "@/app/api/admin/users/route";

const prisma = new PrismaClient();
const TEST_EMAIL_PREFIX = "m2-test-";
const STRONG_PASS = "SagaraTestPass!2026";

async function cleanupTestUsers() {
  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    select: { id: true },
  });
  const ids = testUsers.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
  }
}

describe("M2 Auth, Lockout, and RBAC Integration Suite (TC-X02, TC-X04, TC-X05, TC-X07, TC-X10, TC-X14)", () => {
  beforeEach(async () => {
    currentTestSession.value = null;
    await cleanupTestUsers();
  });

  afterAll(async () => {
    await cleanupTestUsers();
    await prisma.$disconnect();
  });

  it("TC-X02 & TC-X04 (SEC-02, SEC-04): enforces generic failure message, locks account after 5 failures for 15 minutes, rejects valid password while locked, and unlocks after expiry", async () => {
    const passwordHash = await hashPassword(STRONG_PASS);
    const email = `${TEST_EMAIL_PREFIX}lockout@sagaravillas.example.com`;

    const user = await prisma.user.create({
      data: {
        email,
        name: "Lockout Test Staff",
        role: "STAFF",
        passwordHash,
        isActive: true,
      },
    });

    const baseTime = new Date("2026-11-04T10:00:00.000Z");

    // 1. Unknown email vs wrong password return identical error message (TC-X02)
    const unknownRes = await authenticateWithCredentials(
      prisma,
      {
        email: `${TEST_EMAIL_PREFIX}nonexistent@sagaravillas.example.com`,
        password: "WrongPassword!2026",
      },
      { now: baseTime, skipIpRateLimit: true },
    );

    const wrongPass1 = await authenticateWithCredentials(
      prisma,
      { email, password: "WrongPassword!2026" },
      { now: baseTime, skipIpRateLimit: true },
    );

    expect(unknownRes.ok).toBe(false);
    expect(wrongPass1.ok).toBe(false);
    if (!unknownRes.ok && !wrongPass1.ok) {
      expect(unknownRes.error).toBe("Email or password is incorrect.");
      expect(wrongPass1.error).toBe(unknownRes.error);
    }

    // 2. Fail attempts 2..5 to reach the 5-attempt lockout threshold
    for (let attempt = 2; attempt <= 5; attempt++) {
      const res = await authenticateWithCredentials(
        prisma,
        { email, password: "WrongPassword!2026" },
        {
          now: new Date(baseTime.getTime() + attempt * 1000),
          skipIpRateLimit: true,
        },
      );
      expect(res.ok).toBe(false);
    }

    const lockedRecord = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(lockedRecord.failedLoginCount).toBe(5);
    expect(lockedRecord.lockedUntil).not.toBeNull();

    // 3. Correct password DURING the 15-minute lock window must still fail with generic message (TC-X04)
    const duringLockTime = new Date(baseTime.getTime() + 5 * 60 * 1000); // +5 min
    const attemptDuringLock = await authenticateWithCredentials(
      prisma,
      { email, password: STRONG_PASS },
      { now: duringLockTime, skipIpRateLimit: true },
    );
    expect(attemptDuringLock).toEqual({
      ok: false,
      error: "Email or password is incorrect.",
      code: "INVALID_CREDENTIALS",
    });

    // 4. After 15 minutes + 10 seconds, correct password succeeds and resets counters
    const afterLockTime = new Date(baseTime.getTime() + 16 * 60 * 1000); // +16 min
    const successAfterLock = await authenticateWithCredentials(
      prisma,
      { email, password: STRONG_PASS },
      { now: afterLockTime, skipIpRateLimit: true },
    );
    expect(successAfterLock.ok).toBe(true);

    const unlockedRecord = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(unlockedRecord.failedLoginCount).toBe(0);
    expect(unlockedRecord.lockedUntil).toBeNull();
    expect(unlockedRecord.lastLoginAt?.toISOString()).toBe(afterLockTime.toISOString());
  });

  it("TC-X05, TC-X07, TC-X10, TC-X14: enforces RBAC matrix on /api/admin/me and /api/admin/users, rejects inactive users, blocks cross-origin POST, and never leaks passwordHash", async () => {
    const passwordHash = await hashPassword(STRONG_PASS);

    const adminUser = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}admin@sagaravillas.example.com`,
        name: "Test Admin",
        role: "ADMIN",
        passwordHash,
        isActive: true,
      },
    });

    const staffUser = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}staff@sagaravillas.example.com`,
        name: "Test Staff",
        role: "STAFF",
        passwordHash,
        isActive: true,
      },
    });

    const inactiveAdmin = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}inactive@sagaravillas.example.com`,
        name: "Inactive Admin",
        role: "ADMIN",
        passwordHash,
        isActive: false,
      },
    });

    // A. Anonymous -> 401 on /api/admin/me and /api/admin/users
    currentTestSession.value = null;
    const anonMeRes = await getAdminMe(new Request("http://localhost:3000/api/admin/me"));
    expect(anonMeRes.status).toBe(401);
    expect(anonMeRes.headers.get("Cache-Control")).toBe("no-store");
    expect(anonMeRes.headers.get("x-request-id")).toBeTruthy();

    const anonUsersRes = await getAdminUsers(new Request("http://localhost:3000/api/admin/users"));
    expect(anonUsersRes.status).toBe(401);

    // B. Deactivated user with lingering session -> 401 (SEC-03 active re-check)
    currentTestSession.value = {
      expires: new Date(Date.now() + 3600_000).toISOString(),
      user: {
        id: inactiveAdmin.id,
        email: inactiveAdmin.email,
        name: inactiveAdmin.name,
      },
    };
    const inactiveMeRes = await getAdminMe(new Request("http://localhost:3000/api/admin/me"));
    expect(inactiveMeRes.status).toBe(401);

    // C. STAFF -> 200 on /api/admin/me, 403 on GET /api/admin/users and POST /api/admin/users
    currentTestSession.value = {
      expires: new Date(Date.now() + 3600_000).toISOString(),
      user: {
        id: staffUser.id,
        email: staffUser.email,
        name: staffUser.name,
      },
    };

    const staffMeRes = await getAdminMe(new Request("http://localhost:3000/api/admin/me"));
    expect(staffMeRes.status).toBe(200);
    const staffMeBody = await staffMeRes.json();
    expect(staffMeBody.role).toBe("STAFF");

    const staffGetUsersRes = await getAdminUsers(
      new Request("http://localhost:3000/api/admin/users"),
    );
    expect(staffGetUsersRes.status).toBe(403);

    const staffPostUsersRes = await postAdminUsers(
      new Request("http://localhost:3000/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: `${TEST_EMAIL_PREFIX}blocked@sagaravillas.example.com`,
          name: "Blocked Creation",
          role: "STAFF",
          password: STRONG_PASS,
        }),
      }),
    );
    expect(staffPostUsersRes.status).toBe(403);

    // D. ADMIN -> 200 on GET /api/admin/users (never includes passwordHash, TC-X10)
    currentTestSession.value = {
      expires: new Date(Date.now() + 3600_000).toISOString(),
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
      },
    };

    const adminGetUsersRes = await getAdminUsers(
      new Request("http://localhost:3000/api/admin/users"),
    );
    expect(adminGetUsersRes.status).toBe(200);
    expect(adminGetUsersRes.headers.get("Cache-Control")).toBe("no-store");
    const adminUsersBody = await adminGetUsersRes.json();
    expect(Array.isArray(adminUsersBody.data)).toBe(true);
    expect(JSON.stringify(adminUsersBody)).not.toContain("passwordHash");
    expect(JSON.stringify(adminUsersBody)).not.toContain("$argon2id");

    // E. Cross-origin POST /api/admin/users rejected with 403 even for ADMIN (TC-X07)
    const crossOriginPostRes = await postAdminUsers(
      new Request("http://localhost:3000/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://csrf-attacker.example.com",
        },
        body: JSON.stringify({
          email: `${TEST_EMAIL_PREFIX}csrf@sagaravillas.example.com`,
          name: "CSRF User",
          role: "STAFF",
          password: STRONG_PASS,
        }),
      }),
    );
    expect(crossOriginPostRes.status).toBe(403);

    // F. Same-origin POST /api/admin/users by ADMIN -> 201 + AuditLog created + no passwordHash in response
    const createdEmail = `${TEST_EMAIL_PREFIX}created@sagaravillas.example.com`;
    const adminCreateRes = await postAdminUsers(
      new Request("http://localhost:3000/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: createdEmail,
          name: "Created Staff Member",
          role: "STAFF",
          password: STRONG_PASS,
        }),
      }),
    );
    expect(adminCreateRes.status).toBe(201);
    const createdBody = await adminCreateRes.json();
    expect(createdBody.data.email).toBe(createdEmail);
    expect(createdBody.data.role).toBe("STAFF");
    expect(createdBody.data.passwordHash).toBeUndefined();

    // Verify AuditLog was written in the transaction (SEC-17)
    const auditRow = await prisma.auditLog.findFirst({
      where: {
        actorId: adminUser.id,
        action: "user.create",
        entityType: "User",
        entityId: createdBody.data.id,
      },
    });
    expect(auditRow).not.toBeNull();
    expect(JSON.stringify(auditRow?.metadata)).not.toContain("passwordHash");

    // Direct requireRole unit verification with explicit session option
    await expect(
      requireRole(["ADMIN"], {
        session: {
          expires: new Date(Date.now() + 3600_000).toISOString(),
          user: { id: staffUser.id, email: staffUser.email, name: staffUser.name },
        },
        prisma,
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});
