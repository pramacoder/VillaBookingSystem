import { describe, expect, it } from "vitest";
import { createCsvResponse, sanitizeCsvCell, serializeToCsv } from "@/server/reports/csv-export";

describe("SEC-12 (TC-X11): CSV Formula Injection Protection", () => {
  it("neutralizes formula prefix characters (=, +, -, @, tab, CR)", () => {
    // Formula triggers
    expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe(`"'=SUM(A1:A10)"`);
    expect(sanitizeCsvCell("+12345")).toBe(`"'+12345"`);
    expect(sanitizeCsvCell("-5000")).toBe(`"'-5000"`);
    expect(sanitizeCsvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(sanitizeCsvCell("\tcmd|' /C calc'!A0")).toBe(`"'\tcmd|' /C calc'!A0"`);
    expect(sanitizeCsvCell("\r=1+1")).toBe(`"'\r=1+1"`);
  });

  it("safely escapes embedded double quotes and quotes all fields", () => {
    expect(sanitizeCsvCell('John "The Guest" Doe')).toBe('"John ""The Guest"" Doe"');
    expect(sanitizeCsvCell("Normal String")).toBe('"Normal String"');
    expect(sanitizeCsvCell(1250000)).toBe('"1250000"');
    expect(sanitizeCsvCell(null)).toBe('""');
    expect(sanitizeCsvCell(undefined)).toBe('""');
  });

  it("serializes full CSV with headers and records", () => {
    const headers = ["Reference", "Guest", "Amount IDR", "Notes"];
    const rows = [
      ["SGV-001", "Jane Doe", 2500000, "Regular booking"],
      ["SGV-002", '=HYPERLINK("http://malicious.site")', 1800000, "-Potential malicious formula"],
    ];

    const csv = serializeToCsv(headers, rows);
    const lines = csv.split("\r\n");

    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('"Reference","Guest","Amount IDR","Notes"');
    expect(lines[1]).toBe('"SGV-001","Jane Doe","2500000","Regular booking"');
    // Verify malicious formulas are prefixed with single quote
    expect(lines[2]).toContain(`"'=HYPERLINK(""http://malicious.site"")"`);
    expect(lines[2]).toContain(`"'-Potential malicious formula"`);
  });

  it("creates HTTP response with security headers (nosniff, no-store, Content-Disposition)", () => {
    const res = createCsvResponse('"col"\r\n"val"', "test-report.csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="test-report.csv"');
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
