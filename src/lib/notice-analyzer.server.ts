import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server";
import {
  NOTICE_AUTHORITY,
  enforceNoticeSourceState,
  parseNoticeAnalyzerModelText,
  type NoticeAnalyzerInput,
  type NoticeAnalyzerResult,
} from "./notice-analyzer";

const MODEL = "openai/gpt-6-astra";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

function jurisdictionLabel(input: NoticeAnalyzerInput) {
  if (input.jurisdictionType === "federal") return "United States federal";
  return `${input.jurisdictionType}: ${input.jurisdictionDetail}`;
}

function metadataBlock(input: NoticeAnalyzerInput) {
  return [
    input.documentTitle ? `Title: ${input.documentTitle}` : "",
    input.documentType ? `Document type: ${input.documentType}` : "",
    input.issuer ? `Issuer/sender: ${input.issuer}` : "",
    input.receivedDate ? `Received date: ${input.receivedDate}` : "",
    `Target jurisdiction: ${jurisdictionLabel(input)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function analyzeLegalNoticeOnServer(input: NoticeAnalyzerInput): Promise<NoticeAnalyzerResult> {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  if (!lovableApiKey) {
    throw new Error("Notice analysis is unavailable because Lovable AI is not configured.");
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey: lovableApiKey,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    system:
      "You are a source-bound legal notice extraction assistant. You do not provide legal advice and you do not determine governing law. Extract only what is supported by the supplied notice text and metadata. Never invent a deadline, obligation, statute, remedy, court rule, jurisdiction, or consequence. If interpretation or governing-law verification is required, mark it as needing verification or list it as an uncertainty. Governing law and official sources are the authority, not this model output.",
    prompt: `Analyze the notice below as a research aid for a reader preparing to speak with qualified counsel.\n\n${metadataBlock(input)}\n\nNOTICE TEXT:\n${input.noticeText}\n\nReturn ONLY one JSON object with exactly these top-level keys:\n{\n  "criticalDeadlines": [\n    {\n      "date": "explicit date or relative period from the notice, or null",\n      "label": "short neutral description",\n      "urgency": "critical | soon | routine | unknown",\n      "evidence": "short source-bound excerpt or faithful paraphrase from the notice",\n      "needsVerification": true\n    }\n  ],\n  "obligations": [\n    {\n      "action": "what the sender claims the recipient must do",\n      "claimedBy": "sender/issuer if stated, otherwise null",\n      "evidence": "short source-bound excerpt or faithful paraphrase from the notice",\n      "needsVerification": true\n    }\n  ],\n  "questionsForCounsel": ["specific question grounded in this notice"],\n  "uncertainties": ["fact, rule, deadline, jurisdiction, or consequence that cannot be verified from the notice alone"]\n}\n\nRules:\n- Do not add an authority or disclaimer key; the application adds its own immutable authority banner.\n- A printed date can be transcribed, but do not claim it is legally controlling without official-source verification.\n- Do not calculate a statutory deadline that is not expressly stated in the notice.\n- Do not infer guilt, liability, eligibility, or legal strategy.\n- Keep evidence concise and tied to the supplied text.`,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const text = await result.text;
  if (!text.trim()) {
    throw new Error("Notice analysis is unavailable because the AI returned an empty response.");
  }

  let parsed;
  try {
    parsed = parseNoticeAnalyzerModelText(text);
  } catch {
    throw new Error("Notice analysis is unavailable because the AI response could not be validated.");
  }

  return {
    ...enforceNoticeSourceState(parsed),
    authority: NOTICE_AUTHORITY,
    generatedAt: new Date().toISOString(),
    model: MODEL,
  };
}
