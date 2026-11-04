import type { UserRole } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/server/db";
import { authenticateWithCredentials } from "@/server/auth/credentials";
import { extractClientIp, checkRateLimit } from "@/server/security/rate-limit";

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours (SEC-03)
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60; // 1 hour idle refresh

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
}

/**
 * Builds cookie flags compliant with SEC-03 and TC-X03.
 * HttpOnly, SameSite=Lax, Path=/, MaxAge=8h, Secure=true in production (false only in local dev/test).
 */
export function getSessionCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: nodeEnv === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Validates AUTH_SECRET per SEC-14.
 * Production requires an explicit >= 32-character secret and refuses placeholders.
 */
export function resolveAuthSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.AUTH_SECRET?.trim();
  const isProdRuntime =
    env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";

  if (
    secret &&
    secret.length >= 32 &&
    !secret.startsWith("replace-with-") &&
    secret !== "changeme"
  ) {
    return secret;
  }

  if (isProdRuntime) {
    throw new Error(
      "SEC-14 violation: AUTH_SECRET must be set to a strong secret (>= 32 chars) in production.",
    );
  }

  return "dev-only-sagara-villas-auth-secret-do-not-use-in-prod-32chars";
}

export function createAuthConfig(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): NextAuthConfig {
  const cookieOptions = getSessionCookieOptions(nodeEnv);
  const cookieName =
    nodeEnv === "production" ? "__Secure-authjs.session-token" : "authjs.session-token";

  return {
    secret: resolveAuthSecret(),
    trustHost: true,
    pages: {
      signIn: "/admin/login",
    },
    session: {
      strategy: "jwt",
      maxAge: SESSION_MAX_AGE_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    cookies: {
      sessionToken: {
        name: cookieName,
        options: cookieOptions,
      },
    },
    providers: [
      Credentials({
        id: "credentials",
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, request) {
          const clientIp = request instanceof Request ? extractClientIp(request) : "unknown";

          const rateLimit = checkRateLimit({
            key: `login:ip:${clientIp}`,
            limit: 10,
            windowMs: 15 * 60 * 1000,
          });
          if (!rateLimit.allowed) {
            return null;
          }

          const result = await authenticateWithCredentials(db, credentials, {
            clientIp,
          });

          if (!result.ok) {
            return null;
          }

          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          };
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.email = user.email;
          token.name = user.name;
          const maybeRole = (user as { role?: UserRole }).role;
          if (maybeRole) {
            token.role = maybeRole;
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user && typeof token.id === "string") {
          session.user.id = token.id;
          if (typeof token.email === "string") {
            session.user.email = token.email;
          }
          if (typeof token.name === "string") {
            session.user.name = token.name;
          }
          if (token.role === "ADMIN" || token.role === "STAFF") {
            (session.user as { role?: UserRole }).role = token.role;
          }
        }
        return session;
      },
    },
  };
}
