import { RateLimitedError } from "../../lib/errors";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
}

interface BucketRecord {
  count: number;
  resetAtMs: number;
}

const buckets = new Map<string, BucketRecord>();

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = options.nowMs ?? Date.now();
  const existing = buckets.get(options.key);

  if (!existing || existing.resetAtMs <= now) {
    buckets.set(options.key, {
      count: 1,
      resetAtMs: now + options.windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - 1),
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - existing.count),
    retryAfterSeconds: 0,
  };
}

export function assertRateLimit(options: RateLimitOptions): RateLimitResult {
  const result = checkRateLimit(options);
  if (!result.allowed) {
    throw new RateLimitedError(result.retryAfterSeconds);
  }
  return result;
}

export function resetRateLimitStore(): void {
  buckets.clear();
}

export function extractClientIp(request?: Request | null): string {
  if (!request) return "127.0.0.1";
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}
