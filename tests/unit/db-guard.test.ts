import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertLocalDatabaseUrl } from "../../scripts/db-reset";

describe("assertLocalDatabaseUrl (db:reset guard)", () => {
  it("allows localhost and 127.0.0.1 in development/test", () => {
    expect(() =>
      assertLocalDatabaseUrl(
        "postgresql://sagara:pass@localhost:5432/sagara_villas",
        "DATABASE_URL",
        "development",
      ),
    ).not.toThrow();

    expect(() =>
      assertLocalDatabaseUrl(
        "postgresql://sagara:pass@127.0.0.1:5432/sagara_villas",
        "DATABASE_URL",
        "test",
      ),
    ).not.toThrow();
  });

  it("rejects non-local database hosts", () => {
    expect(() =>
      assertLocalDatabaseUrl(
        "postgresql://user:pass@ep-cool-frog-123456.ap-southeast-1.aws.neon.tech:5432/neondb",
        "DATABASE_URL",
        "development",
      ),
    ).toThrow(/not local/i);

    expect(() =>
      assertLocalDatabaseUrl(
        "postgresql://user:pass@db.projectref.supabase.co:5432/postgres",
        "DATABASE_URL",
        "development",
      ),
    ).toThrow(/not local/i);
  });

  it("rejects production NODE_ENV even if host is localhost", () => {
    expect(() =>
      assertLocalDatabaseUrl(
        "postgresql://sagara:pass@localhost:5432/sagara_villas",
        "DATABASE_URL",
        "production",
      ),
    ).toThrow(/production/i);
  });

  it("rejects missing or invalid URLs", () => {
    expect(() => assertLocalDatabaseUrl(undefined, "DATABASE_URL", "development")).toThrow(
      /not set/i,
    );

    expect(() => assertLocalDatabaseUrl("not-a-valid-url", "DATABASE_URL", "development")).toThrow(
      /not a valid URL/i,
    );
  });

  it("exits with code 1 when invoked via CLI with a non-local DATABASE_URL", () => {
    const scriptPath = path.resolve(__dirname, "../../scripts/db-reset.ts");
    const tsxBin = path.resolve(
      __dirname,
      process.platform === "win32"
        ? "../../node_modules/.bin/tsx.cmd"
        : "../../node_modules/.bin/tsx",
    );
    const result = spawnSync(tsxBin, [scriptPath], {
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://u:p@remote.example.com:5432/db",
      },
      encoding: "utf-8",
      shell: process.platform === "win32",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/\[db:reset BLOCKED\].*not local/i);
  });
});
