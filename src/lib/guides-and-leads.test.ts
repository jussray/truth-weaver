import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { INDEXABLE_PATHS, canonicalUrl, pageHead } from "./seo";

describe("Philadelphia Eviction Notice Guide statutory requirements & SEO", () => {
  it("is registered in INDEXABLE_PATHS and has canonical URL", () => {
    expect(INDEXABLE_PATHS).toContain("/guides/philadelphia-eviction-notice");
    expect(canonicalUrl("/guides/philadelphia-eviction-notice")).toBe(
      "https://truthweaver.jussco.company/guides/philadelphia-eviction-notice"
    );
  });

  it("source file contains mandatory citations for 68 P.S. § 250.501 and Phila. Code § 9-804", () => {
    const content = readFileSync("src/routes/guides.philadelphia-eviction-notice.tsx", "utf8");
    expect(content).toContain("68 P.S. § 250.501");
    expect(content).toContain("Phila. Code § 9-804");
    expect(content).toContain("Eviction Diversion Program");
    expect(content).toContain("Certificate of Rental Suitability");
    expect(content).toContain("10-Day Notice");
    expect(content).toContain("15-Day Notice");
    expect(content).toContain("30-Day Notice");
    expect(content).toContain("NON-AUTHORIZING REFERENCE");
    expect(content).toContain("Pugh v. Holmes");
  });

  it("produces valid indexable head metadata with breadcrumbs and FAQ schema", () => {
    const head = pageHead({
      path: "/guides/philadelphia-eviction-notice",
      title: "Philadelphia Eviction Notice Guide: 68 P.S. § 250.501 & Phila. Code § 9-804",
      description: "Plain-English guide to PA 68 P.S. § 250.501 and Philadelphia Code § 9-804.",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Guides", path: "/shop" },
        { name: "Philadelphia Eviction Notice", path: "/guides/philadelphia-eviction-notice" },
      ],
    });

    const robots = head.meta.find((m) => m.name === "robots");
    expect(robots).toEqual({ name: "robots", content: "index, follow" });
    const canonical = head.links.find((l) => l.rel === "canonical");
    expect(canonical?.href).toBe("https://truthweaver.jussco.company/guides/philadelphia-eviction-notice");
  });
});

describe("Signup route authentication and LovableSignInButton", () => {
  it("imports and mounts LovableSignInButton in signup.tsx", () => {
    const content = readFileSync("src/routes/signup.tsx", "utf8");
    expect(content).toContain("LovableSignInButton");
    expect(content).toContain("@/components/auth/lovable-sign-in-button");
    expect(content).toContain("<LovableSignInButton");
  });
});

describe("Inquiry leads intake & tw_inquiries contract", () => {
  it("dashboard leads route enforces ALLEGED_FACT epistemic status", () => {
    const content = readFileSync("src/routes/_authenticated/dashboard.leads.tsx", "utf8");
    expect(content).toContain("ALLEGED_FACT");
    expect(content).toContain("tw_inquiries");
    expect(content).toContain("createIssue");
    expect(content).toContain("Housing & Eviction Defense");
    expect(content).toContain("Debt Collection Defense");
  });

  it("database migration defines tw_inquiries table with RLS", () => {
    const sql = readFileSync("supabase/migrations/20261123120000_tw_inquiries.sql", "utf8");
    expect(sql).toContain("create table if not exists public.tw_inquiries");
    expect(sql).toContain("alter table public.tw_inquiries enable row level security");
    expect(sql).toContain("epistemic_status text not null default 'ALLEGED_FACT'");
  });
});
