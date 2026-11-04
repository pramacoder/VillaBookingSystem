import { ValidationError } from "@/lib/errors";

/**
 * Extracts plain query string parameters from a Request URL.
 * Omits empty-string values so optional Zod fields fall back cleanly.
 */
export function extractSearchParams(request: Request): Record<string, string> {
  const url = new URL(request.url);
  const result: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      result[key] = trimmed;
    }
  }
  return result;
}

/**
 * Parses an `If-Match` version header (e.g. `3`, `"3"`, `W/"3"`).
 * When `required` is true, throws `400 VALIDATION_ERROR` if missing or invalid (API.md §1, §5.2).
 */
export function parseIfMatchVersion(request: Request, required: true): number;
export function parseIfMatchVersion(request: Request, required?: false): number | undefined;
export function parseIfMatchVersion(request: Request, required = false): number | undefined {
  const raw = request.headers.get("if-match")?.trim();
  if (!raw) {
    if (required) {
      throw new ValidationError("If-Match version header is required for reservation updates.", {
        "If-Match": "required",
      });
    }
    return undefined;
  }

  const normalized = raw.replace(/^W\//i, "").replace(/^"|"$/g, "").trim();
  if (!/^\d+$/.test(normalized)) {
    throw new ValidationError("If-Match header must be a positive integer version.", {
      "If-Match": "invalid_version",
    });
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ValidationError("If-Match header must be a positive integer version.", {
      "If-Match": "invalid_version",
    });
  }

  return parsed;
}

/**
 * Parses JSON body from a Request, throwing `400 VALIDATION_ERROR` on malformed JSON.
 * If `allowEmpty` is true, an empty body returns `{}`.
 */
export async function parseJsonBody(
  request: Request,
  options: { allowEmpty?: boolean } = {},
): Promise<unknown> {
  const text = await request.text();
  if (text.trim().length === 0) {
    if (options.allowEmpty) {
      return {};
    }
    throw new ValidationError("Request body must be valid JSON.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}
