/**
 * Shoreline Calm Design Tokens (DESIGN.md §3 & §9).
 * Source of truth for palette hex values, status tokens, and WCAG 2.2 contrast verification.
 */
export const SHORELINE_PALETTE = {
  teal300: "#A2B8B8",
  blue600: "#006BB3",
  blue500: "#006DFF",
  indigo600: "#4E37B6",
  white: "#FFFFFF",
  gray100: "#EEEEEE",
  gray600: "#4B4B4B",
  gray800: "#212121",
  gray900: "#111111",
  black: "#000000",
} as const;

export const STATUS_TOKENS = {
  neutral: {
    bg: "#EEEEEE",
    fg: "#212121",
    iconName: "Circle",
  },
  info: {
    bg: "#E6F0F8",
    fg: "#004C80",
    iconName: "Info",
  },
  active: {
    bg: "#E8E4F7",
    fg: "#3A2A8C",
    iconName: "LogIn",
  },
  success: {
    bg: "#DCFCE7",
    fg: "#14532D",
    iconName: "CheckCircle2",
  },
  warning: {
    bg: "#FEF3C7",
    fg: "#78350F",
    iconName: "Clock",
  },
  danger: {
    bg: "#FEE2E2",
    fg: "#7F1D1D",
    iconName: "AlertCircle",
  },
} as const;

export type StatusTokenVariant = keyof typeof STATUS_TOKENS;

function parseHexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    throw new Error(`Invalid 6-digit hex color: ${hex}`);
  }
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  return [r, g, b];
}

function channelToLinear(channel8Bit: number): number {
  const sRgb = channel8Bit / 255;
  return sRgb <= 0.03928 ? sRgb / 12.92 : ((sRgb + 0.055) / 1.055) ** 2.4;
}

/**
 * Computes WCAG 2.x relative luminance for a 6-digit hex color.
 */
export function computeRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/**
 * Computes the WCAG 2.2 contrast ratio `(L1 + 0.05) / (L2 + 0.05)` between two hex colors.
 */
export function computeContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lumA = computeRelativeLuminance(foregroundHex);
  const lumB = computeRelativeLuminance(backgroundHex);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}
