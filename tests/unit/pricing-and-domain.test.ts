import type { ReservationStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { assertWholeIdr, formatIdr } from "@/lib/money";
import { RESERVATION_CODE_REGEX, generateReservationCode } from "@/lib/reservation-code";
import { normalizeGuestEmail, normalizeGuestPhone } from "@/server/services/guest-service";
import { calculateStayPricing, validateUnitStayRules } from "@/server/services/pricing-service";
import {
  ALLOWED_STATUS_TRANSITIONS,
  assertStatusTransitionAllowed,
  isStatusTransitionAllowed,
} from "@/server/services/reservation-service";

describe("M3 Domain Unit Suite (Pricing TC-P01..TC-P03, Status Matrix TC-S02, Money, Codes, Guest Normalization)", () => {
  it("TC-P01 (BR-08): computes base-rate multi-night total with cleaning fee and discount", () => {
    const result = calculateStayPricing({
      baseRateIdr: 2_500_000,
      cleaningFeeIdr: 300_000,
      checkIn: "2026-11-10",
      checkOut: "2026-11-13", // 3 nights
      discountIdr: 200_000,
    });

    expect(result.nights).toBe(3);
    expect(result.nightlySubtotalIdr).toBe(7_500_000);
    expect(result.cleaningFeeIdr).toBe(300_000);
    expect(result.discountIdr).toBe(200_000);
    expect(result.totalIdr).toBe(7_600_000);
    expect(result.pricingSnapshot.nights).toEqual([
      { date: "2026-11-10", rateIdr: 2_500_000 },
      { date: "2026-11-11", rateIdr: 2_500_000 },
      { date: "2026-11-12", rateIdr: 2_500_000 },
    ]);
  });

  it("TC-P02 (DATABASE.md §6): applies seasonal RateRule only to covered nights and selects the most specific rule when rules overlap", () => {
    const result = calculateStayPricing({
      baseRateIdr: 2_000_000,
      cleaningFeeIdr: 250_000,
      checkIn: "2026-12-23",
      checkOut: "2026-12-27", // 4 nights: Dec 23, 24, 25, 26
      rateRules: [
        {
          label: "Year-End Peak Season",
          startDate: "2026-12-20",
          endDate: "2026-12-31", // 12-day span
          rateIdr: 3_000_000,
        },
        {
          label: "Christmas Eve & Day Special",
          startDate: "2026-12-24",
          endDate: "2026-12-25", // 2-day span (more specific!)
          rateIdr: 3_500_000,
        },
      ],
    });

    expect(result.nights).toBe(4);
    expect(result.pricingSnapshot.nights).toEqual([
      {
        date: "2026-12-23",
        rateIdr: 3_000_000,
        ruleLabel: "Year-End Peak Season",
      },
      {
        date: "2026-12-24",
        rateIdr: 3_500_000,
        ruleLabel: "Christmas Eve & Day Special",
      },
      {
        date: "2026-12-25",
        rateIdr: 3_500_000,
        ruleLabel: "Christmas Eve & Day Special",
      },
      {
        date: "2026-12-26",
        rateIdr: 3_000_000,
        ruleLabel: "Year-End Peak Season",
      },
    ]);
    expect(result.nightlySubtotalIdr).toBe(13_000_000);
    expect(result.totalIdr).toBe(13_250_000);
  });

  it("TC-P03 (BR-08): clamps totalIdr to 0 when discount exceeds nightlySubtotalIdr + cleaningFeeIdr", () => {
    const result = calculateStayPricing({
      baseRateIdr: 1_800_000,
      cleaningFeeIdr: 200_000,
      checkIn: "2026-11-10",
      checkOut: "2026-11-12", // 2 nights = 3,600,000 + 200,000 = 3,800,000
      discountIdr: 5_000_000,
    });

    expect(result.nightlySubtotalIdr).toBe(3_600_000);
    expect(result.totalIdr).toBe(0);
  });

  it("TC-D08 & BR-07: validateUnitStayRules enforces minNights, maxNights, and maxGuests", () => {
    const unit = { minNights: 2, maxNights: 14, maxGuests: 4 };

    // 1 night < minNights (2) -> 422 BUSINESS_RULE
    expect(() =>
      validateUnitStayRules(unit, {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 2,
        children: 0,
      }),
    ).toThrow(/Minimum stay/i);

    // 15 nights > maxNights (14) -> 422 BUSINESS_RULE
    expect(() =>
      validateUnitStayRules(unit, {
        checkIn: "2026-11-01",
        checkOut: "2026-11-16",
        adults: 2,
        children: 0,
      }),
    ).toThrow(/Maximum stay/i);

    // 3 adults + 2 children = 5 > maxGuests (4) -> 422 BUSINESS_RULE
    expect(() =>
      validateUnitStayRules(unit, {
        checkIn: "2026-11-10",
        checkOut: "2026-11-13",
        adults: 3,
        children: 2,
      }),
    ).toThrow(/exceed unit capacity/i);

    // Valid stay passes
    const valid = validateUnitStayRules(unit, {
      checkIn: "2026-11-10",
      checkOut: "2026-11-13",
      adults: 2,
      children: 2,
    });
    expect(valid.nights).toBe(3);
  });

  it("TC-S02 (BR-12): verifies the complete 5x5 reservation status transition matrix", () => {
    const allStatuses: ReservationStatus[] = [
      "PENDING",
      "CONFIRMED",
      "CHECKED_IN",
      "CHECKED_OUT",
      "CANCELLED",
    ];

    const expectedAllowed = new Set([
      "PENDING->CONFIRMED",
      "PENDING->CANCELLED",
      "CONFIRMED->CHECKED_IN",
      "CONFIRMED->CANCELLED",
      "CHECKED_IN->CHECKED_OUT",
    ]);

    for (const from of allStatuses) {
      for (const to of allStatuses) {
        const key = `${from}->${to}`;
        const shouldAllow = expectedAllowed.has(key);

        expect(isStatusTransitionAllowed(from, to), key).toBe(shouldAllow);
        if (shouldAllow) {
          expect(() => assertStatusTransitionAllowed(from, to)).not.toThrow();
        } else {
          expect(() => assertStatusTransitionAllowed(from, to)).toThrow(/not allowed/i);
        }
      }
    }

    expect(Object.keys(ALLOWED_STATUS_TRANSITIONS)).toHaveLength(5);
  });

  it("Money, Reservation Code, and Guest Normalization helpers enforce documented formats", () => {
    expect(formatIdr(2_400_000, "en")).toBe("IDR 2,400,000");
    expect(formatIdr(2_400_000, "id")).toBe("Rp 2.400.000");
    expect(() => assertWholeIdr(1500.5)).toThrow(/whole IDR integer/i);
    expect(() => assertWholeIdr(-100)).toThrow(/cannot be negative/i);
    expect(() => assertWholeIdr(0, "amountIdr", { allowZero: false })).toThrow(
      /greater than zero/i,
    );

    for (let i = 0; i < 25; i++) {
      const code = generateReservationCode(new Date(Date.UTC(2026, 10, 4)));
      expect(code).toMatch(RESERVATION_CODE_REGEX);
      expect(code.startsWith("SGV-2611-")).toBe(true);
      expect(code.slice(9)).not.toMatch(/[0O1IL]/);
    }

    expect(normalizeGuestEmail("  Guest.Name@Example.COM ")).toBe("guest.name@example.com");
    expect(normalizeGuestPhone("+62 (812) 3456-7890")).toBe("+6281234567890");
    expect(normalizeGuestPhone("0812-3456-7890")).toBe("081234567890");
  });
});
