import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server";
import {
  NOTICE_IMAGE_MAX_BYTES,
  estimateBase64Bytes,
  imageExtractionInputSchema,
  parseImageTranscriptionModelText,
  sanitizeSourceName,
  type ImageExtractionInput,
} from "./notice-document";

const MODEL = "openai/gpt-6-astra";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

export async function transcribeNoticeImageOnServer(input: ImageExtractionInput) {
  const parsedInput = imageExtractionInputSchema.parse(input);
  const byteSize = estimateBase64Bytes(parsedInput.base64);
  if (!byteSize || byteSize > NOTICE_IMAGE_MAX_BYTES) {
    throw new Error("That image is too large for notice transcription.");
  }

  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  if (!lovableApiKey) {
    throw new Error("Image transcription is unavailable because Lovable AI is not configured.");
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

  const sourceName = sanitizeSourceName(parsedInput.fileName);
  const result = streamText({
    model: provider.responses(MODEL),
    system:
      "You are a transcription engine, not a legal analyst. Transcribe only text that is visibly present in the supplied image. Preserve wording, spelling, numbers, dates, and reading order as closely as possible. Do not summarize, correct, interpret, infer, or add legal advice. Never invent a name, date, citation, obligation, consequence, or jurisdiction. If text is unreadable, omit it rather than guessing.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Source filename: ${sourceName}. Return ONLY one JSON object with exactly this shape: {"text":"verbatim visible text"}. Do not include markdown fences or commentary.`,
          },
          {
            type: "image",
            image: `data:${parsedInput.mimeType};base64,${parsedInput.base64}`,
          },
        ],
      },
    ],
    providerOptions: {
      openai: {
        store: false,
      },
    },
  });

  const text = await result.text;
  if (!text.trim()) {
    throw new Error("Image transcription returned no readable text.");
  }

  let parsed;
  try {
    parsed = parseImageTranscriptionModelText(text);
  } catch {
    throw new Error("Image transcription could not be validated.");
  }

  return {
    sourceName,
    page: 1,
    text: parsed.text,
    method: "ai-transcription" as const,
    model: MODEL,
  };
}
