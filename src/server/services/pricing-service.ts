import type { PrismaClient } from "@prisma/client";
import { addDaysDateOnly, diffNights, formatDateOnly, parseDateOnly } from "@/lib/dates";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertWholeIdr } from "@/lib/money";
import { quoteRequestSchema } from "@/lib/validation/reservation";
import { findUnitConflicts } from "@/server/services/availability-service";

export interface RateRuleInput {
  id?: string;
  label: string;
  startDate: Date | string;
  endDate: Date | string;
  nightlyRateIdr?: number;
  rateIdr?: number;
  minNights?: number | null;
}

export interface NightlyRateSnapshot {
  date: string;
  rateIdr: number;
  ruleLabel?: string;
}

export interface PricingSnapshot {
  nights: NightlyRateSnapshot[];
  cleaningFeeIdr: number;
  discountIdr: number;
}

export interface StayPricingResult {
  nights: number;
  nightlySubtotalIdr: number;
  cleaningFeeIdr: number;
  discountIdr: number;
  totalIdr: number;
  pricingSnapshot: PricingSnapshot;
}

export interface CalculateStayPricingInput {
  baseRateIdr: number;
  cleaningFeeIdr: number;
  checkIn: Date | string;
  checkOut: Date | string;
  discountIdr?: number;
  rateRules?: readonly RateRuleInput[];
}

function toDateOnly(value: Date | string): Date {
  return typeof value === "string" ? parseDateOnly(value) : parseDateOnly(formatDateOnly(value));
}

/**
 * Selects the most specific RateRule covering night `d` (DATABASE.md §6, TC-P02).
 * Specificity is determined by the shortest date span `(endDate - startDate)`.
 */
function findApplicableRateRule(
  nightDate: Date,
  rateRules: readonly RateRuleInput[],
): { rateIdr: number; label: string } | null {
  const nightMs = nightDate.getTime();
  let best: {
    rateIdr: number;
    label: string;
    spanDays: number;
  } | null = null;

  for (const rule of rateRules) {
    const start = toDateOnly(rule.startDate);
    const end = toDateOnly(rule.endDate);
    const rawRate = rule.nightlyRateIdr ?? rule.rateIdr;
    if (rawRate === undefined) {
      throw new ValidationError("RateRule must specify nightlyRateIdr.");
    }
    if (nightMs >= start.getTime() && nightMs <= end.getTime()) {
      const spanDays = diffNights(start, end) + 1;
      if (
        !best ||
        spanDays < best.spanDays ||
        (spanDays === best.spanDays && rawRate > best.rateIdr)
      ) {
        best = {
          rateIdr: assertWholeIdr(rawRate, "rateRule.nightlyRateIdr", {
            allowZero: false,
          }),
          label: rule.label,
          spanDays,
        };
      }
    }
  }

  return best ? { rateIdr: best.rateIdr, label: best.label } : null;
}

/**
 * Computes nightly breakdown, subtotal, and total in whole IDR (BR-08, DATABASE.md §6).
 * Total is clamped to >= 0 when discount exceeds subtotal + cleaning fee (TC-P03).
 */
export function calculateStayPricing(input: CalculateStayPricingInput): StayPricingResult {
  const checkInDate = toDateOnly(input.checkIn);
  const checkOutDate = toDateOnly(input.checkOut);
  const nightsCount = diffNights(checkInDate, checkOutDate);

  if (nightsCount < 1) {
    throw new ValidationError("checkOut must be after checkIn (BR-02).", {
      checkOut: "check_out_must_be_after_check_in",
    });
  }

  const baseRateIdr = assertWholeIdr(input.baseRateIdr, "baseRateIdr", {
    allowZero: true,
  });
  const cleaningFeeIdr = assertWholeIdr(input.cleaningFeeIdr, "cleaningFeeIdr", {
    allowZero: true,
  });
  const discountIdr = assertWholeIdr(input.discountIdr ?? 0, "discountIdr", {
    allowZero: true,
  });
  const rules = input.rateRules ?? [];

  const nights: NightlyRateSnapshot[] = [];
  let nightlySubtotalIdr = 0;

  for (let i = 0; i < nightsCount; i++) {
    const currentNight = addDaysDateOnly(checkInDate, i);
    const dateStr = formatDateOnly(currentNight);
    const matchedRule = findApplicableRateRule(currentNight, rules);

    const rateIdr = matchedRule ? matchedRule.rateIdr : baseRateIdr;
    nightlySubtotalIdr += rateIdr;

    nights.push({
      date: dateStr,
      rateIdr,
      ...(matchedRule ? { ruleLabel: matchedRule.label } : {}),
    });
  }

  const rawTotal = nightlySubtotalIdr + cleaningFeeIdr - discountIdr;
  const totalIdr = Math.max(0, rawTotal);

  return {
    nights: nightsCount,
    nightlySubtotalIdr,
    cleaningFeeIdr,
    discountIdr,
    totalIdr,
    pricingSnapshot: {
      nights,
      cleaningFeeIdr,
      discountIdr,
    },
  };
}

export interface UnitStayConstraints {
  minNights: number;
  maxNights?: number | null;
  maxGuests: number;
}

/**
 * Enforces BR-02 (date order, minNights, maxNights) and BR-07 (adults >= 1, total guests <= maxGuests).
 */
export function validateUnitStayRules(
  unit: UnitStayConstraints,
  params: {
    checkIn: Date | string;
    checkOut: Date | string;
    adults: number;
    children: number;
    rateRules?: readonly RateRuleInput[];
  },
): { checkInDate: Date; checkOutDate: Date; nights: number } {
  const checkInDate = toDateOnly(params.checkIn);
  const checkOutDate = toDateOnly(params.checkOut);
  const nights = diffNights(checkInDate, checkOutDate);

  if (nights < 1) {
    throw new ValidationError("checkOut must be after checkIn.", {
      checkOut: "check_out_must_be_after_check_in",
    });
  }

  if (!Number.isInteger(params.adults) || params.adults < 1) {
    throw new ValidationError("At least 1 adult is required.", {
      adults: "adults_min_one",
    });
  }

  if (!Number.isInteger(params.children) || params.children < 0) {
    throw new ValidationError("Children count cannot be negative.", {
      children: "children_non_negative",
    });
  }

  // Check if any covered RateRule imposes a stricter minNights
  let effectiveMinNights = unit.minNights;
  if (params.rateRules && params.rateRules.length > 0) {
    for (let i = 0; i < nights; i++) {
      const night = addDaysDateOnly(checkInDate, i);
      const nightMs = night.getTime();
      for (const rule of params.rateRules) {
        const start = toDateOnly(rule.startDate);
        const end = toDateOnly(rule.endDate);
        if (
          nightMs >= start.getTime() &&
          nightMs <= end.getTime() &&
          rule.minNights &&
          rule.minNights > effectiveMinNights
        ) {
          effectiveMinNights = rule.minNights;
        }
      }
    }
  }

  if (nights < effectiveMinNights) {
    throw new AppError(
      "BUSINESS_RULE",
      422,
      `Minimum stay for this unit is ${effectiveMinNights} nights.`,
      { minNights: effectiveMinNights, requestedNights: nights },
    );
  }

  if (unit.maxNights !== null && unit.maxNights !== undefined && nights > unit.maxNights) {
    throw new AppError(
      "BUSINESS_RULE",
      422,
      `Maximum stay for this unit is ${unit.maxNights} nights.`,
      { maxNights: unit.maxNights, requestedNights: nights },
    );
  }

  const totalGuests = params.adults + params.children;
  if (totalGuests > unit.maxGuests) {
    throw new AppError(
      "BUSINESS_RULE",
      422,
      `Total guests (${totalGuests}) exceed unit capacity of ${unit.maxGuests}.`,
      { maxGuests: unit.maxGuests, requestedGuests: totalGuests },
    );
  }

  return { checkInDate, checkOutDate, nights };
}

export interface QuoteResponseDto {
  unitSlug: string;
  nights: number;
  nightlySubtotalIdr: number;
  cleaningFeeIdr: number;
  discountIdr: number;
  totalIdr: number;
  pricingSnapshot: PricingSnapshot;
  isDemo: true;
  available: boolean;
}

/**
 * Computes an informational quote for a public or admin request (API.md §3.4, TC-P05).
 */
export async function getPublicUnitQuote(
  prisma: PrismaClient,
  rawInput: unknown,
): Promise<QuoteResponseDto> {
  const input = quoteRequestSchema.parse(rawInput);

  const unit = await prisma.unit.findUnique({
    where: { slug: input.unitSlug },
    include: {
      rateRules: true,
    },
  });

  if (!unit || unit.status !== "ACTIVE") {
    throw new NotFoundError("Unit not found.");
  }

  const { checkInDate, checkOutDate } = validateUnitStayRules(unit, {
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    children: input.children,
    rateRules: unit.rateRules,
  });

  const pricing = calculateStayPricing({
    baseRateIdr: unit.baseRateIdr,
    cleaningFeeIdr: unit.cleaningFeeIdr,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    discountIdr: input.discountIdr ?? 0,
    rateRules: unit.rateRules,
  });

  const conflicts = await findUnitConflicts(prisma, {
    unitId: unit.id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
  });

  return {
    unitSlug: unit.slug,
    nights: pricing.nights,
    nightlySubtotalIdr: pricing.nightlySubtotalIdr,
    cleaningFeeIdr: pricing.cleaningFeeIdr,
    discountIdr: pricing.discountIdr,
    totalIdr: pricing.totalIdr,
    pricingSnapshot: pricing.pricingSnapshot,
    isDemo: true,
    available: !conflicts.hasConflict,
  };
}
