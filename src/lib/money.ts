import { ValidationError } from "@/lib/errors";

/**
 * Validates that an amount is a whole integer IDR value (BR-08, SEC-07).
 * Floating-point numbers, NaN, Infinity, or negative values (where disallowed) are rejected.
 */
export function assertWholeIdr(
  amountIdr: number,
  fieldName = "amountIdr",
  options: { allowZero?: boolean } = { allowZero: true },
): number {
  const allowZero = options.allowZero ?? true;
  if (!Number.isSafeInteger(amountIdr)) {
    throw new ValidationError(`${fieldName} must be a whole IDR integer.`, {
      [fieldName]: "must_be_integer_idr",
    });
  }
  if (allowZero ? amountIdr < 0 : amountIdr <= 0) {
    throw new ValidationError(
      allowZero ? `${fieldName} cannot be negative.` : `${fieldName} must be greater than zero.`,
      {
        [fieldName]: allowZero ? "must_be_non_negative" : "must_be_positive",
      },
    );
  }
  return amountIdr;
}

/**
 * Formats an integer IDR amount per CONTENT_GUIDE.md §2:
 * - en: "IDR 2,400,000"
 * - id: "Rp 2.400.000"
 */
export function formatIdr(amountIdr: number, locale: "en" | "id" = "en"): string {
  if (!Number.isFinite(amountIdr)) {
    throw new Error("Invalid IDR amount");
  }
  const rounded = Math.trunc(amountIdr);
  const absFormatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, locale === "id" ? "." : ",");

  const prefix = locale === "id" ? "Rp " : "IDR ";
  return rounded < 0 ? `-${prefix}${absFormatted}` : `${prefix}${absFormatted}`;
}
