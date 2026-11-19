import { REPORT_OFFERS } from "./commerce/report-catalog";

/**
 * Store categories. Each maps to a Shopify product_type. A product appears in
 * a category only when the merchant sets that product_type in Shopify; the app
 * never invents catalog items.
 */
export type ShopCategory = {
  slug: "guides" | "templates" | "courses" | "bundles";
  label: string;
  /** Canonical Shopify product_type (singular). Plural legacy value also matched. */
  productType: string;
  summary: string;
  includes: string[];
};

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  {
    slug: "guides",
    label: "Guides",
    productType: "Guide",
    summary: "Plain-English explainers that walk through one legal situation, step by step, and point you to the official sources to check.",
    includes: ["How the process usually works", "Key terms explained", "Where to find the governing law for your place", "Questions to bring to counsel"],
  },
  {
    slug: "templates",
    label: "Templates",
    productType: "Template",
    summary: "Fill-in documents such as letters, checklists and logs, with notes on what to verify for your jurisdiction before you use them.",
    includes: ["Editable document", "Field-by-field notes", "Jurisdiction check reminders", "What not to send without advice"],
  },
  {
    slug: "courses",
    label: "Courses",
    productType: "Course",
    summary: "Short, structured lessons that build real understanding of an area of law and how to research it yourself.",
    includes: ["Lessons in order", "Research exercises using official sources", "Summary sheets", "Self-check questions"],
  },
  {
    slug: "bundles",
    label: "Bundles",
    productType: "Bundle",
    summary: "Guides, templates and research tools for one situation, packaged together at a combined price.",
    includes: ["Everything listed on the bundle", "One price", "Same verification notes as the single items"],
  },
];

export function findCategory(slug: string | undefined): ShopCategory | undefined {
  return SHOP_CATEGORIES.find((c) => c.slug === slug);
}

function quote(value: string): string {
  return `"${value.replace(/["\\]/g, "")}"`;
}

/** Builds the Shopify Storefront search query for a category and/or legal-area tag. */
export function buildShopQuery(categorySlug?: string, area?: string): string | undefined {
  const parts: string[] = [];
  const category = findCategory(categorySlug);
  if (category) parts.push(`(product_type:${quote(category.productType)} OR product_type:${quote(category.slug)})`);
  if (area) parts.push(`tag:${quote(area)}`);
  return parts.length ? parts.join(" AND ") : undefined;
}

/** Preview only: draft catalog records do not prove publication or purchase entitlement. */
export function plannedShopOffers(categorySlug?: string, area?: string) {
  if (area || (categorySlug !== undefined && !findCategory(categorySlug))) return [];
  return Object.values(REPORT_OFFERS).filter(
    (offer) => offer.category !== null && (!categorySlug || offer.category === categorySlug),
  );
}
