import { z } from "zod";

import { NOTICE_AUTHORITY, noticeAnalyzerModelOutputSchema, type NoticeAnalyzerInput, type NoticeAnalyzerResult } from "./notice-analyzer";

/**
 * Truth Weaver Counsel document: a branded, printable compilation of one
 * Notice Analyzer result. It is a research aid only. It is NOT a purchase
 * entitlement, a receipt, legal advice, or verified governing law.
 * Raw notice text is never stored or copied into the document.
 */

export const COUNSEL_STORAGE_KEY = "tw.counsel-document.v1";

export type CounselMetadata = Pick<
  NoticeAnalyzerInput,
  "documentTitle" | "documentType" | "issuer" | "receivedDate" | "jurisdictionType" | "jurisdictionDetail"
>;

const storedSchema = z.object({
  version: z.literal(1),
  savedAt: z.string().datetime(),
  metadata: z.object({
    documentTitle: z.string().max(160),
    documentType: z.string().max(120),
    issuer: z.string().max(160),
    receivedDate: z.string().max(10),
    jurisdictionType: z.enum(["", "federal", "state", "international"]),
    jurisdictionDetail: z.string().max(120),
  }),
  result: noticeAnalyzerModelOutputSchema.extend({
    authority: z.object({ status: z.string(), statement: z.string(), disclaimer: z.string() }),
    generatedAt: z.string().max(40),
    model: z.string().max(80),
  }),
});

export type StoredCounselAnalysis = z.infer<typeof storedSchema>;

export function toStoredAnalysis(metadata: CounselMetadata, result: NoticeAnalyzerResult, now = new Date()): StoredCounselAnalysis {
  return {
    version: 1,
    savedAt: now.toISOString(),
    metadata: {
      documentTitle: metadata.documentTitle ?? "",
      documentType: metadata.documentType ?? "",
      issuer: metadata.issuer ?? "",
      receivedDate: metadata.receivedDate ?? "",
      jurisdictionType: metadata.jurisdictionType,
      jurisdictionDetail: metadata.jurisdictionDetail ?? "",
    },
    result: structuredClone(result),
  };
}

/** Parses untrusted stored JSON. Returns null for anything malformed or tampered. */
export function parseStoredAnalysis(raw: string | null): StoredCounselAnalysis | null {
  if (!raw) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type CounselItem = { title: string; lines: string[]; flag?: string };
export type CounselSection = { id: string; heading: string; empty: string; items: CounselItem[] };

export type CounselDocument = {
  reference: string;
  title: string;
  subtitle: string;
  banner: string[];
  meta: Array<[label: string, value: string]>;
  sections: CounselSection[];
  limits: string[];
  filename: string;
};

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\p{Cc}+/gu, " ").replace(/\s+/g, " ").trim();
}

function orNone(text: string | null | undefined): string {
  return clean(text) || "Not supplied";
}

/** FNV-1a 32-bit; a stable, non-secret document reference (not a receipt). */
function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, "0");
}

function jurisdiction(meta: StoredCounselAnalysis["metadata"]): string {
  if (meta.jurisdictionType === "federal") return "U.S. Federal";
  const layer = meta.jurisdictionType === "state" ? "U.S. State / Territory" : meta.jurisdictionType === "international" ? "International / Supranational" : "Not supplied";
  return meta.jurisdictionDetail ? `${layer}: ${clean(meta.jurisdictionDetail)}` : layer;
}

export function buildCounselDocument(stored: StoredCounselAnalysis): CounselDocument {
  const { metadata, result } = stored;
  const reference = "TW-C-" + fingerprint(JSON.stringify({ metadata, result }));

  const deadlines: CounselItem[] = result.criticalDeadlines.map((d) => ({
    title: clean(d.label),
    lines: [
      `Date stated in notice: ${d.date ? clean(d.date) : "No explicit date extracted"}`,
      `AI urgency label: ${d.urgency} (not legal advice)`,
      `Evidence from supplied notice: ${clean(d.evidence)}`,
    ],
    flag: "Controlling deadline NOT VERIFIED. Check official rules and counsel.",
  }));

  const obligations: CounselItem[] = result.obligations.map((o) => ({
    title: clean(o.action),
    lines: [
      ...(o.claimedBy ? [`Claimed by: ${clean(o.claimedBy)}`] : []),
      `Evidence from supplied notice: ${clean(o.evidence)}`,
    ],
    flag: "Validity of this demand NOT VERIFIED against governing law.",
  }));

  const questions: CounselItem[] = result.questionsForCounsel.map((q, i) => ({ title: `Question ${i + 1}`, lines: [clean(q)] }));
  const gaps: CounselItem[] = result.uncertainties.map((u, i) => ({ title: `Open item ${i + 1}`, lines: [clean(u)] }));

  const titleText = clean(metadata.documentTitle);
  return {
    reference,
    title: "Truth Weaver Counsel",
    subtitle: titleText ? `Notice brief: ${titleText}` : "Notice brief",
    banner: [NOTICE_AUTHORITY.status, NOTICE_AUTHORITY.statement, "EDUCATIONAL RESEARCH AID", "NOT LEGAL ADVICE"],
    meta: [
      ["Document reference", reference],
      ["Analysis generated", orNone(result.generatedAt)],
      ["Document type", orNone(metadata.documentType)],
      ["Issuer stated", orNone(metadata.issuer)],
      ["Relevant date supplied", orNone(metadata.receivedDate)],
      ["Jurisdiction supplied", jurisdiction(metadata)],
      ["Law status", "UNVERIFIED LAW"],
    ],
    sections: [
      { id: "deadlines", heading: "Stated dates & deadlines", empty: "No explicit deadlines were extracted from the supplied text.", items: deadlines },
      { id: "obligations", heading: "Sender's claimed demands", empty: "No demanded actions were extracted from the supplied text.", items: obligations },
      { id: "questions", heading: "Questions to raise with qualified counsel", empty: "No questions were generated.", items: questions },
      { id: "gaps", heading: "Unresolved facts & verification gaps", empty: "No open items were listed. That does not mean none exist.", items: gaps },
    ],
    limits: [
      "Compiled only from the notice text and details you supplied. It does not verify governing law, the effectiveness of the notice, any statutory deadline, liability, or a remedy.",
      "AI extraction can omit or misread information. Compare every date, amount and name with the original notice.",
      "Confirm against current official sources and qualified counsel in the relevant jurisdiction. Governing law is the authority.",
      "This document is not a purchase receipt, entitlement, filing, or legal opinion.",
      clean(result.authority.disclaimer),
    ],
    filename: `truth-weaver-counsel-${reference.toLowerCase()}.pdf`,
  };
}
