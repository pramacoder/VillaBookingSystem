import { describe, expect, it } from "vitest";
import { validateSeedEnv } from "../../prisma/seed";

describe("validateSeedEnv (SEC-01, SEC-02, TC-X18)", () => {
  it("rejects production environment without ALLOW_PRODUCTION_SEED=true", () => {
    expect(() =>
      validateSeedEnv({
        NODE_ENV: "production",
        SEED_ADMIN_EMAIL: "admin@example.com",
        SEED_ADMIN_PASSWORD: "StrongPassword#2026!",
      }),
    ).toThrow(/ALLOW_PRODUCTION_SEED/i);
  });

  it("allows production environment when ALLOW_PRODUCTION_SEED=true is set", () => {
    const creds = validateSeedEnv({
      NODE_ENV: "production",
      ALLOW_PRODUCTION_SEED: "true",
      SEED_ADMIN_EMAIL: "Admin@Example.com",
      SEED_ADMIN_PASSWORD: "StrongPassword#2026!",
    });
    expect(creds.adminEmail).toBe("admin@example.com");
  });

  it("rejects missing or placeholder admin credentials", () => {
    expect(() =>
      validateSeedEnv({
        NODE_ENV: "development",
      }),
    ).toThrow(/SEED_ADMIN_EMAIL/i);

    expect(() =>
      validateSeedEnv({
        NODE_ENV: "development",
        SEED_ADMIN_EMAIL: "admin@example.com",
      }),
    ).toThrow(/SEED_ADMIN_PASSWORD/i);

    expect(() =>
      validateSeedEnv({
        NODE_ENV: "development",
        SEED_ADMIN_EMAIL: "admin@example.com",
        SEED_ADMIN_PASSWORD: "short",
      }),
    ).toThrow(/at least 12 characters/i);

    expect(() =>
      validateSeedEnv({
        NODE_ENV: "development",
        SEED_ADMIN_EMAIL: "admin@example.com",
        SEED_ADMIN_PASSWORD: "replace-with-strong-admin-password-min-12-chars",
      }),
    ).toThrow(/placeholder/i);
  });
});
