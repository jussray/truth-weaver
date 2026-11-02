import { describe, expect, it } from "vitest";
import { MONITORED_URLS, mapInspection, mapSitemap } from "./search-console";

describe("Search Console status normalization", () => {
  it("monitors only the six canonical public URLs", () => {
    expect(MONITORED_URLS).toHaveLength(6);
    expect(MONITORED_URLS.every((url) => url.startsWith("https://truthweaver.jussco.company/"))).toBe(true);
    expect(MONITORED_URLS.some((url) => /merchant|dashboard/.test(url))).toBe(false);
  });
  it("does not fabricate sitemap submission or index counts", () => {
    expect(mapSitemap({ sitemap: [] }).state).toBe("not-submitted");
    const s = mapSitemap({ sitemap: [{ path: "https://truthweaver.jussco.company/sitemap.xml", isPending: true, errors: "2", warnings: "1", contents: [{ submitted: "6", indexed: "999" }] }] });
    expect(s).toMatchObject({ state: "pending", submittedUrls: 6, errors: 2, warnings: 1 });
    expect(JSON.stringify(s)).not.toContain("999");
  });
  it("uses URL Inspection verdict, never infers indexed from sitemap presence", () => {
    const url = MONITORED_URLS[0]!;
    expect(mapInspection(url, { inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Indexed" } } }).state).toBe("indexed");
    expect(mapInspection(url, { inspectionResult: { indexStatusResult: { verdict: "NEUTRAL" } } }).state).toBe("not-indexed");
    expect(mapInspection(url, {}).state).toBe("unknown");
    expect(() => mapInspection("https://evil.example/", {})).toThrow();
  });
});