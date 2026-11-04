import crypto from "node:crypto";

/**
 * Computes a one-way SHA-256 hash of a normalized email for security logs (SEC-18).
 * Never log plaintext guest or account emails.
 */
export function hashEmailForLog(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export interface LogEntry {
  level: "info" | "warn" | "error";
  event: string;
  requestId?: string;
  meta?: Record<string, unknown>;
}

const FORBIDDEN_LOG_KEYS = new Set([
  "password",
  "passwordHash",
  "email",
  "fullName",
  "name",
  "phone",
  "specialRequests",
  "message",
  "token",
  "secret",
]);

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (FORBIDDEN_LOG_KEYS.has(key)) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

export function formatStructuredLog(entry: LogEntry): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: entry.level,
    event: entry.event,
    ...(entry.requestId ? { requestId: entry.requestId } : {}),
    ...(entry.meta ? { meta: sanitizeMeta(entry.meta) } : {}),
  });
}

export function logSecurityEvent(entry: LogEntry): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  const line = formatStructuredLog(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}
