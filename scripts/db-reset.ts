import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWED_LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function loadLocalEnvFiles(): void {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(filePath) && typeof process.loadEnvFile === "function") {
      process.loadEnvFile(filePath);
    }
  }
}

export function assertLocalDatabaseUrl(
  rawUrl: string | undefined,
  envName = "DATABASE_URL",
  nodeEnv = process.env.NODE_ENV,
): void {
  if (nodeEnv === "production") {
    throw new Error(`Refusing destructive database operation: NODE_ENV is "production".`);
  }

  if (!rawUrl || rawUrl.trim() === "") {
    throw new Error(`Refusing destructive database operation: ${envName} is not set.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Refusing destructive database operation: ${envName} is not a valid URL.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing destructive database operation: ${envName} host "${hostname}" is not local (allowed: localhost, 127.0.0.1, ::1).`,
    );
  }
}

function main(): void {
  loadLocalEnvFiles();
  assertLocalDatabaseUrl(process.env.DATABASE_URL, "DATABASE_URL");
  if (process.env.DIRECT_URL) {
    assertLocalDatabaseUrl(process.env.DIRECT_URL, "DIRECT_URL");
  }

  const extraArgs = process.argv.slice(2);
  const prismaCli = path.resolve(process.cwd(), "node_modules/prisma/build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "reset", ...extraArgs], {
    stdio: "inherit",
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";

if (import.meta.url === invokedPath) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[db:reset BLOCKED] ${message}`);
    process.exit(1);
  }
}
