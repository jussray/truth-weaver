import { z } from "zod";

export const evidenceReviewInput = z.object({
  claim: z.string().trim().min(8).max(1500),
  evidence: z.array(z.object({
    label: z.string().trim().min(3).max(120),
    detail: z.string().trim().min(10).max(1500),
    url: z.string().url().startsWith("https://").max(400).optional(),
  }).strict()).min(1).max(6),
  consent: z.literal(true),
}).strict();

export const reviewOutput = z.object({
  gaps: z.array(z.object({ issue: z.string().min(3).max(500), neededProof: z.string().min(3).max(500) }).strict()).max(8),
  attackQuestions: z.array(z.string().min(4).max(400)).max(8),
  nextGate: z.enum(["collect-evidence", "independent-verification", "human-review"]),
  gateReason: z.string().min(8).max(700),
}).strict();

export type EvidenceReviewInput = z.infer<typeof evidenceReviewInput>;
export type ReviewResult = z.infer<typeof reviewOutput> & { model: string; reviewedAt: string; fingerprint: string; authority: "advisory-only" };

export function parseEvidenceReview(text: string) {
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch { throw new Error("AI response was not valid JSON."); }
  return reviewOutput.parse(raw);
}