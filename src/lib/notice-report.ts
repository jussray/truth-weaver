import type { NoticeAnalyzerInput, NoticeAnalyzerResult } from "./notice-analyzer";

/**
 * Deterministic Snapshot export payload. NOT a purchase entitlement.
 * A server-owned, verified paid entitlement is required before enabling
 * customer download. Client order IDs and URL flags are not authority.
 */
export type NoticeSnapshotReport = {
  filename: string;
  mimeType: "text/plain;charset=utf-8";
  content: string;
};

function singleLine(text: string | null | undefined): string {
  return (text ?? "").replace(/\p{Cc}+/gu, " ").trim() || "Not supplied";
}

function block(text: string | null | undefined): string {
  return (text ?? "").replace(/\r\n?/g, "\n").replace(/\p{Cc}/gu, (character) => character === "\n" ? "\n" : "").trim() || "Not supplied";
}

function numbered(lines: readonly string[]): string {
  return lines.length ? lines.map((line, i) => String(i + 1) + ". " + block(line)).join("\n") : "None extracted.";
}

export function buildNoticeSnapshotReport(
  result: NoticeAnalyzerResult,
  input: Pick<
    NoticeAnalyzerInput,
    "documentTitle" | "documentType" | "issuer" | "receivedDate" | "jurisdictionType" | "jurisdictionDetail"
  >,
): NoticeSnapshotReport {
  const deadlineLines = result.criticalDeadlines.map((item, i) => [
    String(i + 1) + ". " + singleLine(item.label),
    "   Date stated in notice: " + singleLine(item.date),
    "   AI urgency label (not legal advice): " + singleLine(item.urgency),
    "   Evidence from supplied text: " + block(item.evidence),
    "   Legally controlling deadline: NOT VERIFIED. Check official rules.",
  ].join("\n"));
  const actionLines = result.obligations.map((item, i) => [
    String(i + 1) + ". " + block(item.action),
    "   Claimed by: " + singleLine(item.claimedBy),
    "   Evidence from supplied text: " + block(item.evidence),
    "   Validity of demand: NOT VERIFIED. Check governing law.",
  ].join("\n"));

  // Do not automatically copy raw notice text or buyer identity details.
  const content = [
    "TRUTH WEAVER | NOTICE SNAPSHOT",
    "EDUCATIONAL RESEARCH AID | NOT LEGAL ADVICE | NON-AUTHORIZING",
    "",
    "Generated: " + singleLine(result.generatedAt),
    "Document: " + singleLine(input.documentTitle),
    "Document type: " + singleLine(input.documentType),
    "Issuer stated: " + singleLine(input.issuer),
    "Date received (supplied): " + singleLine(input.receivedDate),
    "Jurisdiction supplied: " + singleLine(input.jurisdictionType) + " / " + singleLine(input.jurisdictionDetail),
    "",
    "STATED DATES / DEADLINES (UNVERIFIED)",
    deadlineLines.join("\n\n") || "None extracted.",
    "",
    "SENDER'S CLAIMED DEMANDS (NOT LEGAL FINDINGS)",
    actionLines.join("\n\n") || "None extracted.",
    "",
    "QUESTIONS TO RAISE WITH QUALIFIED COUNSEL",
    numbered(result.questionsForCounsel),
    "",
    "UNRESOLVED FACTS / VERIFICATION GAPS",
    numbered(result.uncertainties),
    "",
    "SOURCE AND AUTHORITY LIMITS",
    "Generated from supplied notice text and metadata. This report does not verify governing law,",
    "the effectiveness of the notice, a statutory deadline, liability, or a legal remedy.",
    "AI extraction can omit or misread information. Consult current official sources and",
    "qualified counsel in the relevant jurisdiction. Do not rely on AI urgency labels alone.",
    singleLine(result.authority.disclaimer),
    "",
  ].join("\n");

  return {
    filename: "truth-weaver-notice-snapshot.txt",
    mimeType: "text/plain;charset=utf-8",
    content,
  };
}
