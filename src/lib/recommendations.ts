import { z } from "zod";

import type { ShopifyProduct } from "./shopify";

export const MAX_RECOMMENDATIONS = 3;
export const handleSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,254}$/, "Invalid product handle");

export type RecommendationMode = "ai" | "category" | "none";

export type Recommendation = { product: ShopifyProduct; reason: string };

export type RecommendationResult = {
  mode: RecommendationMode;
  items: Recommendation[];
  /** Plain-language note when the AI pick was unavailable. */
  notice: string | null;
};

/** Every other product in the real catalog that can actually be bought. */
export function candidatesFor(current: ShopifyProduct, catalog: readonly ShopifyProduct[]): ShopifyProduct[] {
  const seen = new Set<string>();
  return catalog.filter((p) => {
    const n = p.node;
    if (n.handle === current.node.handle || seen.has(n.handle)) return false;
    if (!n.variants.edges.some((v) => v.node.availableForSale)) return false;
    seen.add(n.handle);
    return true;
  });
}

const modelOutputSchema = z.object({
  recommendations: z
    .array(z.object({ handle: z.string().max(255), reason: z.string().trim().min(1).max(240) }))
    .max(10),
});

/**
 * Accepts only handles that exist in the supplied candidate list, dedupes,
 * and caps the count. The model can never introduce a product.
 */
export function parseRecommendationOutput(text: string, candidates: readonly ShopifyProduct[]): Recommendation[] {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Recommendation output had no JSON object.");
  const parsed = modelOutputSchema.parse(JSON.parse(trimmed.slice(start, end + 1)));
  const byHandle = new Map(candidates.map((p) => [p.node.handle, p]));
  const out: Recommendation[] = [];
  const used = new Set<string>();
  for (const r of parsed.recommendations) {
    const product = byHandle.get(r.handle);
    if (!product || used.has(r.handle)) continue;
    used.add(r.handle);
    out.push({ product, reason: r.reason.replace(/\p{Cc}+/gu, " ") });
    if (out.length >= MAX_RECOMMENDATIONS) break;
  }
  return out;
}

/** Deterministic, clearly-labeled fallback: shared tags/type, then catalog order. */
export function categoryFallback(current: ShopifyProduct, candidates: readonly ShopifyProduct[]): Recommendation[] {
  const tags = new Set((current.node.tags ?? []).map((t) => t.toLowerCase()));
  const type = current.node.productType?.toLowerCase() ?? "";
  const scored = candidates
    .map((p, index) => {
      const shared = (p.node.tags ?? []).filter((t) => tags.has(t.toLowerCase())).length;
      const sameType = type !== "" && p.node.productType?.toLowerCase() === type ? 1 : 0;
      return { p, score: shared * 2 + sameType, index };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, MAX_RECOMMENDATIONS).map(({ p }) => ({
    product: p,
    reason: p.node.productType && p.node.productType.toLowerCase() === type ? `Also in ${p.node.productType}` : "Shares a topic with this item",
  }));
}
