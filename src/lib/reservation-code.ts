import crypto from "node:crypto";
import { formatDateOnly, todayInPropertyTz } from "@/lib/dates";

export const RESERVATION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" as const;

export const RESERVATION_CODE_REGEX = /^SGV-\d{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

/**
 * Generates a human-friendly reservation reference code per DATABASE.md §8:
 * Format: `SGV-YYMM-XXXX` where `XXXX` uses `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
 * Not a secret; never used to authorize access.
 */
export function generateReservationCode(referenceDate?: Date): string {
  const baseDate = referenceDate ?? todayInPropertyTz();
  const ymd = formatDateOnly(baseDate); // YYYY-MM-DD
  const yy = ymd.slice(2, 4);
  const mm = ymd.slice(5, 7);

  let suffix = "";
  for (let i = 0; i < 4; i++) {
    const idx = crypto.randomInt(0, RESERVATION_CODE_ALPHABET.length);
    suffix += RESERVATION_CODE_ALPHABET[idx];
  }

  return `SGV-${yy}${mm}-${suffix}`;
}
