import { describe, expect, it } from "vitest";

import { createScannedPdf } from "./pdf-export";

describe("on-device document PDF export", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  it("encodes multiple page objects without invoking any server", async () => {
    const result = createScannedPdf([
      { jpeg, width: 800, height: 1200 },
      { jpeg, width: 1200, height: 800 },
    ]);
    expect(result.type).toBe("application/pdf");
    const content = await result.text();
    expect(content).toContain("%PDF-1.4");
    expect(content).toContain("/Count 2");
    expect(content).toContain("/Subtype /Image");
    expect(content).toContain("xref");
    expect(content).toContain("startxref");
    expect(content).toContain("%%EOF");
  });

  it("refuses empty, oversized, or malformed scans", () => {
    expect(() => createScannedPdf([])).toThrow(/1–6 pages/);
    expect(() => createScannedPdf(Array(7).fill({ jpeg, width: 800, height: 1200 }))).toThrow(/1–6 pages/);
    expect(() => createScannedPdf([{ jpeg: new Uint8Array([0, 1, 2, 3]), width: 800, height: 1200 }])).toThrow(/invalid JPEG/);
    expect(() => createScannedPdf([{ jpeg, width: 0, height: 1200 }])).toThrow(/invalid JPEG/);
  });
});
