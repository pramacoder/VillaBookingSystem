import type { PaymentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  computeNetPaidIdr,
  computeOverpaidIdr,
  derivePaymentStatus,
  type PaymentEntryLike,
} from "../../src/lib/payments";

interface TransitionTableRow {
  label: string;
  totalIdr: number;
  payments: PaymentEntryLike[];
  expectedNetIdr: number;
  expectedStatus: PaymentStatus;
  expectedOverpaidIdr: number;
}

/**
 * Exact 7 rows from docs/DATABASE.md §5.4 Payment status transition table.
 */
const TRANSITION_TABLE: readonly TransitionTableRow[] = [
  {
    label: "3,000,000 total | none -> net 0 | UNPAID",
    totalIdr: 3_000_000,
    payments: [],
    expectedNetIdr: 0,
    expectedStatus: "UNPAID",
    expectedOverpaidIdr: 0,
  },
  {
    label: "3,000,000 total | +1,000,000 -> net 1,000,000 | PARTIAL",
    totalIdr: 3_000_000,
    payments: [{ kind: "PAYMENT", amountIdr: 1_000_000 }],
    expectedNetIdr: 1_000_000,
    expectedStatus: "PARTIAL",
    expectedOverpaidIdr: 0,
  },
  {
    label: "3,000,000 total | +1,000,000, +2,000,000 -> net 3,000,000 | PAID",
    totalIdr: 3_000_000,
    payments: [
      { kind: "PAYMENT", amountIdr: 1_000_000 },
      { kind: "PAYMENT", amountIdr: 2_000_000 },
    ],
    expectedNetIdr: 3_000_000,
    expectedStatus: "PAID",
    expectedOverpaidIdr: 0,
  },
  {
    label: "3,000,000 total | +3,000,000, refund 500,000 -> net 2,500,000 | PARTIAL",
    totalIdr: 3_000_000,
    payments: [
      { kind: "PAYMENT", amountIdr: 3_000_000 },
      { kind: "REFUND", amountIdr: 500_000 },
    ],
    expectedNetIdr: 2_500_000,
    expectedStatus: "PARTIAL",
    expectedOverpaidIdr: 0,
  },
  {
    label: "3,000,000 total | +3,500,000 -> net 3,500,000 | PAID (overpaid 500,000)",
    totalIdr: 3_000_000,
    payments: [{ kind: "PAYMENT", amountIdr: 3_500_000 }],
    expectedNetIdr: 3_500_000,
    expectedStatus: "PAID",
    expectedOverpaidIdr: 500_000,
  },
  {
    label: "3,000,000 total | +3,000,000, then void it -> net 0 | UNPAID",
    totalIdr: 3_000_000,
    payments: [
      {
        kind: "PAYMENT",
        amountIdr: 3_000_000,
        voidedAt: new Date("2026-11-04T08:00:00Z"),
      },
    ],
    expectedNetIdr: 0,
    expectedStatus: "UNPAID",
    expectedOverpaidIdr: 0,
  },
  {
    label: "0 total (complimentary) | none -> net 0 | PAID",
    totalIdr: 0,
    payments: [],
    expectedNetIdr: 0,
    expectedStatus: "PAID",
    expectedOverpaidIdr: 0,
  },
];

describe("derivePaymentStatus & DATABASE.md §5.4 transition table (BR-09)", () => {
  it.each(TRANSITION_TABLE)(
    "matches table row: $label",
    ({ totalIdr, payments, expectedNetIdr, expectedStatus, expectedOverpaidIdr }) => {
      const netPaidIdr = computeNetPaidIdr(payments);
      expect(netPaidIdr).toBe(expectedNetIdr);

      const status = derivePaymentStatus(totalIdr, netPaidIdr);
      expect(status).toBe(expectedStatus);

      const overpaidIdr = computeOverpaidIdr(totalIdr, netPaidIdr);
      expect(overpaidIdr).toBe(expectedOverpaidIdr);
    },
  );
});
