import { z } from "zod";

export const NOTICE_TEXT_MAX = 25_000;

export const noticeAnalyzerInputSchema = z
  .object({
    noticeText: z.string().trim().min(40, "Paste at least 40 characters from the notice.").max(NOTICE_TEXT_MAX),
    jurisdictionType: z.enum(["federal", "state", "international"]),
    jurisdictionDetail: z.string().trim().max(120).optional().default(""),
    documentTitle: z.string().trim().max(160).optional().default(""),
    documentType: z.string().trim().max(120).optional().default(""),
    issuer: z.string().trim().max(160).optional().default(""),
    receivedDate: z.string().trim().max(40).optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.jurisdictionType !== "federal" && !value.jurisdictionDetail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jurisdictionDetail"],
        message: "Add the relevant state, territory, country, court, or supranational body.",
      });
    }
  });

export type NoticeAnalyzerInput = z.infer<typeof noticeAnalyzerInputSchema>;

const deadlineSchema = z
  .object({
    date: z.string().trim().max(120).nullable(),
    label: z.string().trim().min(1).max(240),
    urgency: z.enum(["critical", "soon", "routine", "unknown"]),
    evidence: z.string().trim().min(1).max(700),
    needsVerification: z.boolean(),
  })
  .strict();

const obligationSchema = z
  .object({
    action: z.string().trim().min(1).max(500),
    claimedBy: z.string().trim().max(200).nullable(),
    evidence: z.string().trim().min(1).max(700),
    needsVerification: z.boolean(),
  })
  .strict();

export const noticeAnalyzerModelOutputSchema = z
  .object({
    criticalDeadlines: z.array(deadlineSchema).max(20),
    obligations: z.array(obligationSchema).max(20),
    questionsForCounsel: z.array(z.string().trim().min(1).max(500)).max(12),
    uncertainties: z.array(z.string().trim().min(1).max(500)).max(12),
  })
  .strict();

export type NoticeAnalyzerModelOutput = z.infer<typeof noticeAnalyzerModelOutputSchema>;

export const NOTICE_AUTHORITY = {
  status: "NON-AUTHORIZING" as const,
  statement: "GOVERNING LAW IS THE AUTHORITY" as const,
  disclaimer:
    "This AI output is a research aid, not legal advice, a legal filing, or a verified statement of governing law. Confirm deadlines, duties, and remedies against official sources and qualified counsel in the relevant jurisdiction.",
};

export type NoticeAnalyzerResult = NoticeAnalyzerModelOutput & {
  authority: typeof NOTICE_AUTHORITY;
  generatedAt: string;
  model: string;
};

export function parseNoticeAnalyzerModelText(text: string): NoticeAnalyzerModelOutput {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI response did not contain a JSON object.");
  }
  const parsed = JSON.parse(withoutFence.slice(start, end + 1));
  return noticeAnalyzerModelOutputSchema.parse(parsed);
}
