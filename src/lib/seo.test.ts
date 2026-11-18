import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalUrl, INDEXABLE_PATHS, pageHead, safeJsonLd, faqPageJsonLd } from "./seo";

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


  it("emits valid FAQPage schema with faqPageJsonLd without script breakout", () => {
    const faq = [
      { q: "Is Truth Weaver free?", a: "Yes, basic research is free." },
      { q: "Is it legal advice?", a: "No, consult an attorney." },
    ];
    const ld = faqPageJsonLd(faq);
    expect(ld["@type"]).toBe("FAQPage");
    expect(Array.isArray(ld["mainEntity"])).toBe(true);
    expect((ld["mainEntity"] as unknown[]).length).toBe(2);
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
    expect(sitemap).not.toMatch(/lastmod|product\/|merchant|dashboard/);
    expect(locs.some((l) => l!.includes("?"))).toBe(false);
  });
  it("robots declares the absolute sitemap and blocks private areas", () => {
    expect(robots).toContain("Sitemap: https://truthweaver.jussco.company/sitemap.xml");
    expect(robots).toMatch(/Disallow: \/merchant/);
  });
});

describe("llms.txt AI crawler manifest", () => {
  const llms = readFileSync("public/llms.txt", "utf8");
  it("contains canonical title, disclaimers, and canonical URLs", () => {
    expect(llms).toContain("# Truth Weaver Counsel");
    expect(llms).toContain("https://truthweaver.jussco.company/");
    expect(llms).toContain("Not Legal Advice");
    expect(llms).toContain("Verification Requirement");
  });
});
