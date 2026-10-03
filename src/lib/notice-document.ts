import { z } from "zod";

import { NOTICE_TEXT_MAX } from "./notice-analyzer";

export const NOTICE_DOCUMENT_MAX_BYTES = 8_000_000;
export const NOTICE_IMAGE_MAX_BYTES = 4_000_000;
export const NOTICE_PDF_MAX_PAGES = 20;

export const SUPPORTED_NOTICE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type SupportedNoticeImageType = (typeof SUPPORTED_NOTICE_IMAGE_TYPES)[number];

export type ExtractedNoticePage = {
  page: number;
  text: string;
};

const extractedNoticePageSchema = z
  .object({
    page: z.number().int().positive().max(NOTICE_PDF_MAX_PAGES),
    text: z.string().trim().min(1).max(NOTICE_TEXT_MAX),
  })
  .strict();

export const imageExtractionInputSchema = z
  .object({
    fileName: z.string().trim().min(1).max(240),
    mimeType: z.enum(SUPPORTED_NOTICE_IMAGE_TYPES),
    base64: z.string().trim().min(16).max(6_000_000),
  })
  .strict();

export type ImageExtractionInput = z.infer<typeof imageExtractionInputSchema>;

const imageTranscriptionOutputSchema = z
  .object({
    text: z.string().trim().min(1).max(NOTICE_TEXT_MAX),
  })
  .strict();

export function sanitizeSourceName(fileName: string) {
  const cleaned = fileName
    .replace(/[\r\n]/g, " ")
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return cleaned || "uploaded-document";
}

export function estimateBase64Bytes(base64: string) {
  const normalized = base64.replace(/\s+/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

export function formatExtractedPages(sourceName: string, pages: ExtractedNoticePage[]) {
  if (!pages.length) {
    throw new Error("No readable text was extracted from that document.");
  }

  const cleanSource = sanitizeSourceName(sourceName);
  const validated = pages.map((page) => extractedNoticePageSchema.parse(page)).sort((a, b) => a.page - b.page);
  const formatted = validated
    .map((page) => `[SOURCE: ${cleanSource} | PAGE ${page.page}]\n${page.text.trim()}`)
    .join("\n\n");

  if (formatted.length > NOTICE_TEXT_MAX) {
    throw new Error(`Extracted notice text exceeds the ${NOTICE_TEXT_MAX.toLocaleString()} character analysis limit.`);
  }

  return formatted;
}

export function parseImageTranscriptionModelText(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Image transcription did not contain a JSON object.");
  }

  const parsed = JSON.parse(withoutFence.slice(start, end + 1));
  return imageTranscriptionOutputSchema.parse(parsed);
}
