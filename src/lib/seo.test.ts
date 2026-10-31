import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalUrl, INDEXABLE_PATHS, pageHead, safeJsonLd } from "./seo";

describe("seo helpers", () => {
  it("builds absolute canonical URLs without query or trailing slash", () => {
    expect(canonicalUrl("/")).toBe("https://truthweaver.jussco.company/");
    expect(canonicalUrl("/shop?category=guides")).toBe("https://truthweaver.jussco.company/shop");
    expect(canonicalUrl("/sources/")).toBe("https://truthweaver.jussco.company/sources");
    expect(() => canonicalUrl("//evil.com")).toThrow();
  });

  it("escapes script breakout in JSON-LD", () => {
    expect(safeJsonLd({ x: "</script><b>" })).not.toMatch(/<\/script>/);
  });

  it("private pages are noindex with no canonical, image or JSON-LD", () => {
    const h = pageHead({ path: "/dashboard", title: "t", description: "d", noindex: true });
    expect(h.meta).toContainEqual({ name: "robots", content: "noindex, nofollow" });
    expect(h.links).toEqual([]);
    expect(h.scripts).toEqual([]);
  });

  it("public pages never emit Product, Offer, ratings or prices", () => {
    const ld = pageHead({ path: "/shop", title: "t", description: "d" }).scripts[0]!.children;
    expect(ld).not.toMatch(/"Product"|"Offer"|aggregateRating|"price"/);
  });
});

describe("robots and sitemap", () => {
  const sitemap = readFileSync("public/sitemap.xml", "utf8");
  const robots = readFileSync("public/robots.txt", "utf8");
  it("sitemap lists exactly the indexable pages, without lastmod", () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(INDEXABLE_PATHS.map(canonicalUrl));
    expect(sitemap).not.toMatch(/lastmod|product\/|merchant|dashboard|\?/);
  });
  it("robots declares the absolute sitemap and blocks private areas", () => {
    expect(robots).toContain("Sitemap: https://truthweaver.jussco.company/sitemap.xml");
    expect(robots).toMatch(/Disallow: \/merchant/);
  });
});
