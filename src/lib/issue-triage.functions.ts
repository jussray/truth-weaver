import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const LEGAL_AREAS = [
  "Housing & Real Estate",
  "Credit & Debt",
  "Family & Relationships",
  "Business & Entrepreneurship",
  "Contracts & Agreements",
  "Criminal Law",
  "Health & Disability",
  "Immigration",
  "Government & Civil Rights",
  "Employment & Workplace",
  "International Law",
] as const;

const inputSchema = z.object({ text: z.string().trim().min(3).max(2000) });

export type AiTriageResult = { area: string; reason: string }[];

export const triageIssueWithAi = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }): Promise<AiTriageResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI triage is not configured.");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai-run-id.server");
    const runId = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runId.fetch,
    });
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system:
        "You route a visitor's described problem to legal practice areas for browsing only. You never state what law applies or give legal advice.",
      prompt: `Allowed areas (use exact strings): ${LEGAL_AREAS.join(" | ")}\n\nVisitor problem:\n${data.text}\n\nReturn ONLY JSON: {"areas":[{"area":"<exact area>","reason":"<one short neutral sentence>"}]} with 1-3 entries ordered by relevance.`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    return parseTriageText(await result.text);
  });

export function parseTriageText(text: string): AiTriageResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI triage returned no result.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error("AI triage output was malformed.");
  }
  const areas = (parsed as { areas?: unknown }).areas;
  if (!Array.isArray(areas)) throw new Error("AI triage output was malformed.");
  const seen = new Set<string>();
  const out: AiTriageResult = [];
  for (const a of areas) {
    const area = typeof a?.area === "string" ? a.area : "";
    const reason = typeof a?.reason === "string" ? a.reason.trim() : "";
    if (!(LEGAL_AREAS as readonly string[]).includes(area) || !reason || seen.has(area)) continue;
    seen.add(area);
    out.push({ area, reason: reason.slice(0, 200) });
    if (out.length === 3) break;
  }
  return out;
}
