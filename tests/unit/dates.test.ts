import { describe, expect, it } from "vitest";
import {
  addDaysDateOnly,
  diffNights,
  formatDateOnly,
  getPropertyToday,
  getPropertyTodayString,
  parseDateOnly,
  rangesOverlap,
} from "../../src/lib/dates";

describe("date-only and Asia/Makassar timezone helpers (BR-01, BR-02, BR-14, TC-D10)", () => {
  it("TC-D10: computes 'today' in Asia/Makassar (UTC+8) across UTC 15:59 / 16:01 rollover", () => {
    // 15:59 UTC on 2026-11-04 is 23:59 WITA on 2026-11-04
    const beforeMidnightWita = new Date("2026-11-04T15:59:59.000Z");
    expect(getPropertyTodayString(beforeMidnightWita, "Asia/Makassar")).toBe("2026-11-04");
    expect(formatDateOnly(getPropertyToday(beforeMidnightWita, "Asia/Makassar"))).toBe(
      "2026-11-04",
    );

    // 16:00 UTC on 2026-11-04 is 00:00 WITA on 2026-11-05
    const atMidnightWita = new Date("2026-11-04T16:00:00.000Z");
    expect(getPropertyTodayString(atMidnightWita, "Asia/Makassar")).toBe("2026-11-05");

    // 16:01 UTC on 2026-11-04 is 00:01 WITA on 2026-11-05
    const afterMidnightWita = new Date("2026-11-04T16:01:00.000Z");
    expect(getPropertyTodayString(afterMidnightWita, "Asia/Makassar")).toBe("2026-11-05");
    expect(formatDateOnly(getPropertyToday(afterMidnightWita, "Asia/Makassar"))).toBe("2026-11-05");
  });

  it("parses and formats valid YYYY-MM-DD strings without timezone drift", () => {
    const parsed = parseDateOnly("2026-12-26");
    expect(parsed.toISOString()).toBe("2026-12-26T00:00:00.000Z");
    expect(formatDateOnly(parsed)).toBe("2026-12-26");
  });

  it("rejects malformed or impossible calendar dates", () => {
    expect(() => parseDateOnly("2026/12/26")).toThrow(/Invalid date-only/i);
    expect(() => parseDateOnly("2026-02-30")).toThrow(/Invalid calendar date/i);
    expect(() => parseDateOnly("2026-13-01")).toThrow(/Invalid calendar date/i);
  });

  it("computes stay nights and date additions accurately", () => {
    expect(diffNights("2026-12-26", "2026-12-29")).toBe(3);
    expect(formatDateOnly(addDaysDateOnly("2026-12-30", 3))).toBe("2027-01-02");
  });

  it("treats [checkIn, checkOut) as half-open so same-day turnover does not overlap (BR-01)", () => {
    expect(rangesOverlap("2026-12-10", "2026-12-14", "2026-12-14", "2026-12-18")).toBe(false);
    expect(rangesOverlap("2026-12-10", "2026-12-14", "2026-12-13", "2026-12-16")).toBe(true);
  });
});
