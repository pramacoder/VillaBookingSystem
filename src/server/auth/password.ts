import { hash, verify } from "@node-rs/argon2";
import { ValidationError } from "../../lib/errors";

export const MIN_PASSWORD_LENGTH = 12;

const COMMON_PASSWORDS = new Set([
  "123456789012",
  "1234567890123",
  "password1234",
  "password12345",
  "password123456",
  "qwertyuiop12",
  "qwerty123456",
  "admin1234567",
  "administrator",
  "sagaravillas",
  "sagaravillas1",
  "letmein12345",
  "welcome12345",
  "iloveyou1234",
  "changeme1234",
]);

let cachedDummyHashPromise: Promise<string> | null = null;

function getDummyPasswordHash(): Promise<string> {
  if (!cachedDummyHashPromise) {
    cachedDummyHashPromise = hash("dummy-constant-time-secret-value-2026");
  }
  return cachedDummyHashPromise;
}

/**
 * Validates password strength per SEC-01:
 * - Minimum length 12 characters.
 * - Checked against common passwords list.
 * - No composition rules theater.
 */
export function validatePasswordStrength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`, {
      password: "password_too_short",
    });
  }

  const normalized = password.trim().toLowerCase();
  if (
    COMMON_PASSWORDS.has(normalized) ||
    /^(.)\1{11,}$/.test(normalized) ||
    normalized.startsWith("replace-with-")
  ) {
    throw new ValidationError(
      "Password is too common or predictable. Choose a less common phrase.",
      { password: "password_too_common" },
    );
  }
}

/**
 * Hashes a plaintext password with argon2id after enforcing SEC-01 policy.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  validatePasswordStrength(plaintext);
  return hash(plaintext);
}

/**
 * Verifies a password against an argon2id hash.
 */
export async function verifyPassword(passwordHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plaintext);
  } catch {
    return false;
  }
}

/**
 * Performs constant-time password verification (SEC-02, TC-X02).
 * When no stored hash is available (unknown email), verifies against a dummy argon2id hash
 * so response timing is indistinguishable from an existing account with a wrong password.
 */
export async function verifyPasswordConstantTime(
  passwordHash: string | null | undefined,
  plaintext: string,
): Promise<boolean> {
  if (!passwordHash) {
    const dummyHash = await getDummyPasswordHash();
    await verify(dummyHash, plaintext).catch(() => false);
    return false;
  }
  return verifyPassword(passwordHash, plaintext);
}
