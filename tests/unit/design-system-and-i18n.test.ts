import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import enMessages from "../../messages/en.json";
import idMessages from "../../messages/id.json";
import { SHORELINE_PALETTE, STATUS_TOKENS, computeContrastRatio } from "@/lib/design-tokens";
import {
  PaymentStatusBadge,
  ReservationStatusBadge,
  UnitStatusBadge,
  getPaymentStatusMeta,
  getReservationStatusMeta,
} from "@/components/ui/status-badge";
import { isNavItemActive } from "@/lib/admin-nav";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, nextKey));
    } else {
      keys.push(nextKey);
    }
  }
  return keys.sort();
}

function getByPath(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function collectTsxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsxFiles(full));
    } else if (entry.isFile() && full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("M4 Design System, Accessibility Contrast, and Localization Suite (DESIGN.md §3, TC-L01, TC-U14)", () => {
  it("DESIGN.md §3.1 & §3.2: verifies WCAG 2.2 AA contrast (>= 4.5:1) for all Shoreline Calm and status token pairs", () => {
    expect(
      computeContrastRatio(SHORELINE_PALETTE.gray800, SHORELINE_PALETTE.white),
    ).toBeGreaterThanOrEqual(15);
    expect(
      computeContrastRatio(SHORELINE_PALETTE.gray600, SHORELINE_PALETTE.white),
    ).toBeGreaterThanOrEqual(8);
    expect(
      computeContrastRatio(SHORELINE_PALETTE.gray600, SHORELINE_PALETTE.gray100),
    ).toBeGreaterThanOrEqual(6.5);
    expect(
      computeContrastRatio(SHORELINE_PALETTE.white, SHORELINE_PALETTE.blue600),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      computeContrastRatio(SHORELINE_PALETTE.white, SHORELINE_PALETTE.indigo600),
    ).toBeGreaterThanOrEqual(7);
    expect(
      computeContrastRatio(SHORELINE_PALETTE.gray800, SHORELINE_PALETTE.teal300),
    ).toBeGreaterThanOrEqual(7);

    // Forbidden combinations on teal-300 must be below 4.5:1 (Rule 18)
    expect(computeContrastRatio(SHORELINE_PALETTE.white, SHORELINE_PALETTE.teal300)).toBeLessThan(
      3,
    );
    expect(computeContrastRatio(SHORELINE_PALETTE.blue600, SHORELINE_PALETTE.teal300)).toBeLessThan(
      3.5,
    );

    // Every functional status token pair must meet >= 4.5:1 (DESIGN.md §3.2)
    for (const [name, token] of Object.entries(STATUS_TOKENS)) {
      const ratio = computeContrastRatio(token.fg, token.bg);
      expect(
        ratio,
        `status-${name} (${token.fg} on ${token.bg}) must be >= 4.5:1`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("AGENTS.md Rule 18: scans all .tsx files to ensure bg-teal-300 never uses white or blue text", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const tsxFiles = collectTsxFiles(srcDir);
    expect(tsxFiles.length).toBeGreaterThan(5);

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, "utf8");
      const classMatches = content.match(/className=["'{`][^"'}]+["'}`]/g) ?? [];
      for (const cls of classMatches) {
        if (cls.includes("bg-teal-300")) {
          expect(cls, `${path.basename(file)} must not use text-white on bg-teal-300`).not.toMatch(
            /\btext-(white|blue-500|blue-600)\b/,
          );
        }
      }
    }
  });

  it("TC-L01 & CONTENT_GUIDE §5.3: messages/en.json and messages/id.json have identical key sets and exact status labels", () => {
    const enKeys = flattenKeys(enMessages as unknown as Record<string, unknown>);
    const idKeys = flattenKeys(idMessages as unknown as Record<string, unknown>);

    expect(enKeys).toEqual(idKeys);
    expect(enKeys.length).toBeGreaterThan(40);

    for (const key of enKeys) {
      const enVal = getByPath(enMessages as unknown as Record<string, unknown>, key);
      const idVal = getByPath(idMessages as unknown as Record<string, unknown>, key);
      expect(typeof enVal, `en.${key}`).toBe("string");
      expect(typeof idVal, `id.${key}`).toBe("string");
      expect((enVal as string).trim().length, `en.${key} non-empty`).toBeGreaterThan(0);
      expect((idVal as string).trim().length, `id.${key} non-empty`).toBeGreaterThan(0);
    }

    // Exact status labels per CONTENT_GUIDE.md §5.3
    expect(enMessages.statuses.reservation).toEqual({
      PENDING: "Pending",
      CONFIRMED: "Confirmed",
      CHECKED_IN: "Checked in",
      CHECKED_OUT: "Checked out",
      CANCELLED: "Cancelled",
    });
    expect(idMessages.statuses.reservation).toEqual({
      PENDING: "Menunggu",
      CONFIRMED: "Terkonfirmasi",
      CHECKED_IN: "Sudah check-in",
      CHECKED_OUT: "Sudah check-out",
      CANCELLED: "Dibatalkan",
    });
    expect(enMessages.statuses.payment).toEqual({
      UNPAID: "Unpaid",
      PARTIAL: "Partially paid",
      PAID: "Paid",
    });
    expect(idMessages.statuses.payment).toEqual({
      UNPAID: "Belum dibayar",
      PARTIAL: "Dibayar sebagian",
      PAID: "Lunas",
    });
  });

  it("TC-U14 (DESIGN.md §3.2): status badges always render both an icon (<svg>) and localized text label", () => {
    expect(getReservationStatusMeta("PENDING", "en")).toEqual({
      variant: "neutral",
      label: "Pending",
    });
    expect(getReservationStatusMeta("CONFIRMED", "id")).toEqual({
      variant: "info",
      label: "Terkonfirmasi",
    });
    expect(getPaymentStatusMeta("PARTIAL", "id")).toEqual({
      variant: "warning",
      label: "Dibayar sebagian",
    });

    const resBadgeHtml = renderToStaticMarkup(
      ReservationStatusBadge({ status: "CHECKED_IN", locale: "id" }),
    );
    expect(resBadgeHtml).toContain("<svg");
    expect(resBadgeHtml).toContain('aria-hidden="true"');
    expect(resBadgeHtml).toContain("Sudah check-in");

    const futureUnpaidHtml = renderToStaticMarkup(
      PaymentStatusBadge({
        status: "UNPAID",
        locale: "en",
        isFutureStay: true,
      }),
    );
    expect(futureUnpaidHtml).toContain("<svg");
    expect(futureUnpaidHtml).toContain("Unpaid");
    expect(futureUnpaidHtml).toContain("border-status-danger-fg/50");

    const unitBadgeHtml = renderToStaticMarkup(UnitStatusBadge({ status: "ACTIVE", locale: "id" }));
    expect(unitBadgeHtml).toContain("<svg");
    expect(unitBadgeHtml).toContain("Aktif");
  });

  it("AdminShell navigation active matcher highlights exact /admin and subpaths for modules", () => {
    expect(isNavItemActive("/admin", "/admin")).toBe(true);
    expect(isNavItemActive("/admin/reservations", "/admin")).toBe(false);
    expect(isNavItemActive("/admin/reservations", "/admin/reservations")).toBe(true);
    expect(isNavItemActive("/admin/reservations/res_123", "/admin/reservations")).toBe(true);
  });
});
