export const PROPERTY_TIMEZONE = "Asia/Makassar";

export const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * Parses a strict YYYY-MM-DD calendar date string into a UTC-midnight Date
 * suitable for PostgreSQL `@db.Date` columns.
 */
export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_REGEX.exec(value);
  if (!match) {
    throw new Error(`Invalid date-only format "${value}". Expected YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${value}".`);
  }

  return date;
}

/**
 * Normalizes a Date or YYYY-MM-DD string to a UTC-midnight Date.
 */
export function toDateOnly(value: Date | string): Date {
  if (typeof value === "string") {
    return parseDateOnly(value);
  }
  if (Number.isNaN(value.getTime())) {
    throw new Error("Invalid Date instance.");
  }
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * Formats a UTC-midnight Date (from `@db.Date` or `parseDateOnly`) as YYYY-MM-DD.
 */
export function formatDateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid Date instance.");
  }
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's calendar date string (YYYY-MM-DD) in the property timezone (`Asia/Makassar`).
 */
export function getPropertyTodayString(
  now: Date = new Date(),
  timeZone: string = process.env.PROPERTY_TIMEZONE || PROPERTY_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Failed to format date in timezone "${timeZone}".`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Returns today's calendar date in the property timezone (`Asia/Makassar`)
 * as a UTC-midnight Date suitable for `@db.Date` comparisons.
 */
export function getPropertyToday(
  now: Date = new Date(),
  timeZone: string = process.env.PROPERTY_TIMEZONE || PROPERTY_TIMEZONE,
): Date {
  return parseDateOnly(getPropertyTodayString(now, timeZone));
}

export const todayInPropertyTz = getPropertyToday;

/**
 * Adds a signed integer number of calendar days to a date-only value.
 */
export function addDaysDateOnly(value: Date | string, days: number): Date {
  if (!Number.isInteger(days)) {
    throw new Error(`Days offset must be an integer, received ${days}.`);
  }
  const base = toDateOnly(value);
  return new Date(base.getTime() + days * MS_PER_DAY);
}

/**
 * Computes the number of stay nights between checkIn and checkOut (`checkOut - checkIn`).
 */
export function diffNights(checkIn: Date | string, checkOut: Date | string): number {
  const start = toDateOnly(checkIn);
  const end = toDateOnly(checkOut);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * Checks whether two half-open date ranges `[startA, endA)` and `[startB, endB)` overlap.
 * Same-day turnover (`endA === startB` or `endB === startA`) does NOT overlap (BR-01).
 */
export function rangesOverlap(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string,
): boolean {
  const a0 = toDateOnly(startA).getTime();
  const a1 = toDateOnly(endA).getTime();
  const b0 = toDateOnly(startB).getTime();
  const b1 = toDateOnly(endB).getTime();
  return a0 < b1 && b0 < a1;
}
