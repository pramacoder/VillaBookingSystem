import { ForbiddenError } from "../../lib/errors";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function extractOrigin(urlString: string | null | undefined): string | null {
  if (!urlString) return null;
  try {
    return new URL(urlString).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Enforces SEC-06 CSRF protection on state-changing requests:
 * - Rejects cross-site `Sec-Fetch-Site` headers.
 * - Verifies `Origin` (or fallback `Referer`) matches the site origin.
 */
export function verifySameOrigin(request: Request, configuredSiteUrl?: string): void {
  const method = request.method.toUpperCase();
  if (!STATE_CHANGING_METHODS.has(method)) {
    return;
  }

  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite === "cross-site") {
    throw new ForbiddenError("Cross-site request rejected (SEC-06).");
  }

  const expectedOrigin =
    extractOrigin(configuredSiteUrl) ??
    extractOrigin(process.env.AUTH_URL) ??
    extractOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    extractOrigin(request.url);

  if (!expectedOrigin) {
    throw new ForbiddenError("Unable to determine expected request origin.");
  }

  const requestOrigin =
    extractOrigin(request.headers.get("origin")) ?? extractOrigin(request.headers.get("referer"));

  if (!requestOrigin || requestOrigin !== expectedOrigin) {
    throw new ForbiddenError("Origin verification failed (SEC-06).");
  }
}
