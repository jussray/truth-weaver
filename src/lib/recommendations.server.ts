import { GatewayError, generateResponse } from "@lovable.dev/ai-gateway";

import {
  MAX_RECOMMENDATIONS,
  candidatesFor,
  categoryFallback,
  parseRecommendationOutput,
  type RecommendationResult,
} from "./recommendations";
import { fetchProductByHandle, fetchProducts, type ShopifyProduct } from "./shopify";

const MODEL = "openai/gpt-6-astra";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; value: RecommendationResult }>();

function summarize(p: ShopifyProduct) {
  const n = p.node;
  return {
    handle: n.handle,
    title: n.title,
    type: n.productType ?? "",
    tags: (n.tags ?? []).slice(0, 12),
    description: n.description.slice(0, 400),
  };
}

function outputText(response: unknown): string {
  const output = (response as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output ?? [];
  return output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
}

export async function recommendForHandle(handle: string): Promise<RecommendationResult> {
  // The shop list is a capped first page; resolve the viewed product directly so
  // product pages beyond that page are still eligible for recommendations.
  const [current, catalog] = await Promise.all([fetchProductByHandle(handle), fetchProducts()]);
  if (!current) return { mode: "none", items: [], notice: null };
  const candidates = candidatesFor(current, catalog);
  if (candidates.length === 0) return { mode: "none", items: [], notice: null };

  const key = handle + "|" + candidates.map((c) => c.node.id).sort().join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let value: RecommendationResult;
  try {
    const response = await generateResponse({
      model: MODEL,
      reasoning: { effort: "low" },
      instructions:
        "You recommend related items from a legal-education store. Choose ONLY handles from the provided candidate list. Prefer items that genuinely complement the current item for the same reader. Give one short, factual reason per pick based only on the item descriptions. Never give legal advice, never claim outcomes, never invent features or prices.",
      input: [
        {
          role: "user",
          content: `Return JSON. Current item:\n${JSON.stringify(summarize(current))}\n\nCandidates:\n${JSON.stringify(candidates.map(summarize))}\n\nPick up to ${MAX_RECOMMENDATIONS} candidates, most relevant first. If none are genuinely related, return an empty list.`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recommendations",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["recommendations"],
            properties: {
              recommendations: {
                type: "array",
                maxItems: MAX_RECOMMENDATIONS,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["handle", "reason"],
                  properties: { handle: { type: "string" }, reason: { type: "string" } },
                },
              },
            },
          },
        },
      },
    });
    const items = parseRecommendationOutput(outputText(response), candidates);
    value = { mode: "ai", items, notice: null };
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error("Recommendation AI failed", error.code, error.httpStatus, error.ids);
    } else {
      console.error("Recommendation AI output rejected", error);
    }
    const items = categoryFallback(current, candidates);
    value = { mode: items.length ? "category" : "none", items, notice: "Personalized picks are unavailable right now, so these are matched by category." };
    return value; // do not cache failures
  }

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}
