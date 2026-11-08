import { buildCounselDocument, type StoredCounselAnalysis } from "../counsel-document";
import { NOTICE_AUTHORITY } from "../notice-analyzer";
import { offerLabels, reportKindsFor, type ReportKind, type ReportOfferKey } from "./report-catalog";

/**
 * Deterministic content for one paid order's PDF. Built only from the buyer's
 * saved, server-produced analysis. Educational research aid: it never states
 * that a deadline, demand or remedy is legally valid. Governing law decides.
 */
export type ReportBlock =
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "fields"; rows: Array<[string, string]> }
  | { type: "item"; title: string; lines: string[]; flag?: string }
  | { type: "blanks"; label: string; lines: number }
  | { type: "table"; columns: string[]; widths: number[]; rows: string[][]; blankRows: number }
  | { type: "letter"; lines: string[] };

export type ReportPart = { kind: ReportKind; title: string; intro: string; blocks: ReportBlock[] };

export type PaidReportDocument = {
  reference: string;
  title: string;
  subtitle: string;
  banner: string[];
  meta: Array<[string, string]>;
  parts: ReportPart[];
  limits: string[];
  filename: string;
};

export type PaidReportInput = {
  orderId: string;
  orderName: string;
  offers: readonly ReportOfferKey[];
  stored: StoredCounselAnalysis;
  generatedAt: Date;
};

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\p{Cc}+/gu, " ").replace(/\s+/g, " ").trim();
}

function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, "0");
}

export function describePlace(meta: StoredCounselAnalysis["metadata"]): string {
  if (meta.jurisdictionType === "federal") return "United States (federal)";
  const detail = clean(meta.jurisdictionDetail);
  if (meta.jurisdictionType === "state") return detail ? `${detail} (U.S. state or territory)` : "a U.S. state or territory";
  if (meta.jurisdictionType === "international") return detail || "the country or body you named";
  return "the place you named";
}

type Ctx = {
  stored: StoredCounselAnalysis;
  place: string;
  title: string;
  issuer: string;
  received: string;
  docType: string;
};

function snapshotPart(ctx: Ctx): ReportPart {
  const doc = buildCounselDocument(ctx.stored);
  const blocks: ReportBlock[] = [];
  for (const section of doc.sections) {
    blocks.push({ type: "subheading", text: section.heading });
    if (section.items.length === 0) blocks.push({ type: "paragraph", text: section.empty });
    for (const item of section.items) blocks.push({ type: "item", title: item.title, lines: item.lines, ...(item.flag ? { flag: item.flag } : {}) });
  }
  return {
    kind: "snapshot",
    title: "Notice Snapshot",
    intro: "The dates, demands and open questions your saved analysis found in the notice. Compare every line with the original notice.",
    blocks,
  };
}

function lawLayers(ctx: Ctx): string[] {
  const type = ctx.stored.metadata.jurisdictionType;
  if (type === "federal") {
    return [
      "Federal statutes: the United States Code, published by the Office of the Law Revision Counsel (uscode.house.gov).",
      "Federal regulations: the Electronic Code of Federal Regulations (ecfr.gov) and the Federal Register (federalregister.gov).",
      "Official federal publications: govinfo.gov.",
      "Federal court rules and forms: uscourts.gov and the website of the court involved.",
      "State and local law can apply to the same situation. Check those layers too.",
    ];
  }
  if (type === "state") {
    return [
      `The official website of the ${ctx.place} legislature for the current statutes or code.`,
      "The state's administrative code or register for regulations made by state agencies.",
      "The state judiciary's website for court rules, official forms and self-help pages.",
      "Your city or county's official code for local ordinances.",
      "Federal law can apply to the same situation. Check that layer too.",
    ];
  }
  return [
    `The official legislation portal or official gazette for ${ctx.place}.`,
    "The ministry, agency or regulator responsible for the subject, for rules and official guidance.",
    "Court or tribunal websites for procedure rules, forms and decisions.",
    "Treaties or regional (supranational) law, but only where they actually apply in that place.",
    "Regional and local rules can apply too. Check each layer that could cover the situation.",
  ];
}

function guidePart(ctx: Ctx): ReportPart {
  const { result } = ctx.stored;
  const blocks: ReportBlock[] = [
    { type: "subheading", text: "What you received" },
    {
      type: "fields",
      rows: [
        ["Document", ctx.title || "Not supplied"],
        ["Type", ctx.docType || "Not supplied"],
        ["From", ctx.issuer || "Not supplied"],
        ["Date received", ctx.received || "Not supplied"],
        ["Place", ctx.place],
      ],
    },
    { type: "subheading", text: "Your timeline" },
  ];
  if (result.criticalDeadlines.length === 0) {
    blocks.push({ type: "paragraph", text: "The analysis found no stated dates. Read the notice again for phrases such as \"within ... days\", \"on or before\" or \"no later than\", and ask a lawyer whether any time limit applies anyway." });
  }
  for (const d of result.criticalDeadlines) {
    blocks.push({
      type: "item",
      title: `${d.date ? clean(d.date) : "No exact date"}: ${clean(d.label)}`,
      lines: [
        `From the notice: ${clean(d.evidence)}`,
        `Check: which rule sets this time limit in ${ctx.place}, when counting starts, and whether calendar or business days count.`,
      ],
      flag: "Stated date only. Not yet verified.",
    });
  }
  blocks.push(
    { type: "subheading", text: "Step-by-step plan" },
    {
      type: "numbered",
      items: [
        `Keep the original notice, the envelope or email it came in, and a note of how and when you received it${ctx.received ? ` (you entered ${ctx.received})` : ""}.`,
        "Put every stated date in your calendar now and mark each one \"not yet verified\". If a date is close, contact a lawyer or legal aid first and research second.",
        "Work out who sent the notice: a court, a government agency, or a private party such as a landlord, lender or employer. Court and agency papers usually show a case or reference number.",
        `For each demand below, find the rule or agreement the sender relies on, and check whether the governing law of ${ctx.place} lets them require it in this way and by this date.`,
        "Gather your documents: contracts, leases, receipts, letters, emails, photos and anything the notice mentions.",
        "Before you sign, pay, admit anything or reply in writing, make sure you understand what you are agreeing to. A lawyer can tell you what the governing law requires.",
        "Write down your questions (a list is below) and contact a lawyer, a legal aid organization, a lawyer referral service or a court self-help center where one is available.",
      ],
    },
    { type: "subheading", text: "Each demand, one at a time" },
  );
  if (result.obligations.length === 0) blocks.push({ type: "paragraph", text: "The analysis found no demands. Read the notice again for anything it asks you to do, pay, sign or stop doing." });
  for (const o of result.obligations) {
    blocks.push({
      type: "item",
      title: clean(o.action),
      lines: [
        ...(o.claimedBy ? [`Claimed by: ${clean(o.claimedBy)}`] : []),
        `From the notice: ${clean(o.evidence)}`,
        "Check: is there a law, regulation, court rule or contract term that requires this? Does it apply to you, and on these dates?",
        "Gather: proof of anything you have already done, paid or sent about this.",
      ],
      flag: "Validity not verified against governing law.",
    });
  }
  blocks.push(
    { type: "subheading", text: `How to find the governing law for ${ctx.place}` },
    { type: "bullets", items: lawLayers(ctx) },
    { type: "paragraph", text: "When you find a rule, check that it is the version in force on the date that matters (often the date of the notice or of the events), and whether it has since been amended, repealed or interpreted by a court. Guides, articles and AI summaries, including this one, can help you find the law but are not the law itself." },
    { type: "paragraph", text: "Truth Weaver's Sources page lists the official sources registered so far for some places. A listing is not a guarantee of complete or current coverage." },
    { type: "subheading", text: "Questions to bring to a lawyer" },
    {
      type: "numbered",
      items: [
        ...result.questionsForCounsel.map(clean),
        "What is the real deadline in my situation, and how is it counted?",
        "What could happen if I do nothing, and what could happen if I respond?",
        "What options do I have, and what would each one cost?",
      ],
    },
    { type: "subheading", text: "Still unknown" },
    result.uncertainties.length
      ? { type: "bullets", items: result.uncertainties.map(clean) }
      : { type: "paragraph", text: "No open items were listed. That does not mean none exist." },
  );
  return {
    kind: "guide",
    title: "Notice Response Guide",
    intro: `This guide turns your saved analysis into a plan. Every date and demand below comes from the notice as the analysis read it. None of it has been checked against the governing law of ${ctx.place}. Use the steps to check.`,
    blocks,
  };
}

function templatesPart(ctx: Ctx): ReportPart {
  const { result } = ctx.stored;
  const stated = result.criticalDeadlines.map((d) => [d.date ? clean(d.date) : "No exact date", clean(d.label), "", ""]);
  return {
    kind: "templates",
    title: "Notice Response Templates",
    intro: "Print these pages or copy them into your own document, then fill in the blanks. None of them is an official court or agency form. Check with a lawyer before sending anything.",
    blocks: [
      { type: "subheading", text: "Deadline tracker" },
      { type: "paragraph", text: "Stated dates from your analysis are filled in. Add the verified date and the rule that sets it only once you have checked an official source or spoken with a lawyer." },
      { type: "table", columns: ["Stated in notice", "What it is", "Verified date and rule", "Done"], widths: [0.2, 0.36, 0.34, 0.1], rows: stated, blankRows: 3 },
      { type: "subheading", text: "Records and communications log" },
      { type: "table", columns: ["Date", "Who", "How (mail, email, call, visit)", "What was said or sent"], widths: [0.14, 0.2, 0.22, 0.44], rows: [], blankRows: 10 },
      { type: "subheading", text: "Request for information: letter outline" },
      { type: "paragraph", text: "Use this only if a lawyer or legal aid advisor agrees it suits your situation. Asking for information may not pause any deadline." },
      {
        type: "letter",
        lines: [
          "[Your name]",
          "[Your address]",
          "[Date]",
          "",
          `To: ${ctx.issuer || "[Name of sender]"}`,
          `Re: ${ctx.title || "[Notice title or reference number]"}${ctx.received ? `, received ${ctx.received}` : ""}`,
          "",
          "I received your notice and am reviewing it. Please send me, in writing:",
          "1. A copy of any contract, account record or other document the notice relies on.",
          "2. The specific law, regulation, rule or contract term you say requires each action in the notice.",
          "3. A breakdown of any amount claimed.",
          "4. The name and contact details of the person handling this matter.",
          "",
          "This letter is a request for information only.",
          "",
          "[Signature]",
        ],
      },
      { type: "subheading", text: "What not to send without advice" },
      {
        type: "bullets",
        items: [
          "Statements admitting what happened or what you owe.",
          "Signed agreements, settlements or payment plans.",
          "Payments, unless you understand what they mean for your rights.",
          "Your original documents. Send copies and keep the originals.",
        ],
      },
      { type: "subheading", text: "Lawyer intake sheet" },
      {
        type: "fields",
        rows: [
          ["Notice", ctx.title || "Not supplied"],
          ["From", ctx.issuer || "Not supplied"],
          ["Received", ctx.received || "Not supplied"],
          ["Place", ctx.place],
          ["Stated dates", result.criticalDeadlines.map((d) => `${d.date ? clean(d.date) : "no exact date"} (${clean(d.label)})`).join("; ") || "None found"],
        ],
      },
      { type: "paragraph", text: "Questions I want answered:" },
      { type: "numbered", items: result.questionsForCounsel.length ? result.questionsForCounsel.map(clean) : ["What does this notice mean for me, and what is the real deadline?"] },
      { type: "blanks", label: "What outcome do I want?", lines: 3 },
      { type: "blanks", label: "What has happened so far?", lines: 5 },
      { type: "bullets", items: ["[ ] The notice", "[ ] Envelope or email it came in", "[ ] Contract, lease or agreement", "[ ] Receipts and payment records", "[ ] Letters, emails and messages", "[ ] Photos"] },
    ],
  };
}

function coursePart(ctx: Ctx): ReportPart {
  const { result } = ctx.stored;
  const dates = result.criticalDeadlines.map((d) => `${d.date ? clean(d.date) : "No exact date"}: ${clean(d.label)} (not yet verified)`);
  const qa: Array<[string, string]> = [];
  const lesson = (title: string, paragraphs: string[], apply: string[], checks: Array<[string, string]>): ReportBlock[] => {
    qa.push(...checks);
    return [
      { type: "subheading", text: title },
      ...paragraphs.map((text): ReportBlock => ({ type: "paragraph", text })),
      { type: "paragraph", text: "Apply it to your notice:" },
      { type: "bullets", items: apply },
      { type: "paragraph", text: "Self-check:" },
      { type: "numbered", items: checks.map(([q]) => q) },
    ];
  };
  const blocks: ReportBlock[] = [
    ...lesson(
      "Lesson 1: Reading a legal notice",
      [
        "A legal notice is a written message that claims something about your rights or duties: that you owe money, must leave a property, must answer a claim, or must act by a date. It is the sender's statement. On its own, it is not a decision that you are wrong.",
        "Most notices contain the same parts: who sent it and for whom, who it is addressed to, what the sender says happened, what the sender wants you to do, the dates involved, what the sender says will happen if you do not act, and how to respond.",
        "Papers from a court or a government agency carry different weight from letters sent by a private party. Court papers usually show the court's name and a case number; agency notices usually show the agency's name and a reference number. If you are not sure which kind you have, treat it as urgent and ask.",
      ],
      [
        `Your analysis read the document as: ${ctx.docType || "type not supplied"}, from ${ctx.issuer || "a sender not supplied"}.`,
        `It found ${result.obligations.length} demand(s) and ${result.criticalDeadlines.length} stated date(s). Compare each with the original notice.`,
        "Mark the sentence in the notice that says what happens if you do nothing.",
      ],
      [
        ["Does a notice from a private sender, on its own, decide that you are in the wrong?", "No. It is the sender's statement. Whether it is correct depends on the facts and the governing law."],
        ["What two details usually show that a document comes from a court?", "The court's name and a case number."],
      ],
    ),
    ...lesson(
      "Lesson 2: Dates and deadlines",
      [
        "A notice can involve several dates: the date written on it, the date it was sent, the date you received it, and the date by which something must happen. Which of these starts a time period depends on the rules that apply.",
        "Rules differ on how days are counted: calendar days or business days, whether weekends and public holidays count, and whether extra days are added for mail. A deadline printed in a notice may not match the deadline the law actually sets, in either direction.",
        "Keep proof of when you received the notice and of anything you send: postmarks, email timestamps, delivery receipts or a dated note made at the time.",
      ],
      [...(dates.length ? dates : ["Your analysis found no stated dates. Read the notice again for time limits."]), "Write down how you received the notice and on what date."],
      [
        ["If a notice says \"within 10 days\", do you know from that phrase alone which days count?", "No. The governing rules decide whether calendar or business days count and when counting starts."],
        ["Name one way to prove when you received a notice.", "Keep the envelope with its postmark, the email with its timestamp, a delivery receipt, or a dated note made at the time."],
      ],
    ),
    ...lesson(
      "Lesson 3: Finding the governing law",
      [
        "Governing law is the law that actually applies to your situation. It depends on where things happened, who is involved, what the issue is, and the date that matters. More than one layer can apply at once, such as national, state or provincial, and local law.",
        "Primary sources are the law itself: constitutions, statutes or codes, regulations, court rules, local ordinances and, in many legal systems, binding court decisions. Secondary sources such as guides, textbooks, articles and AI summaries explain the law and help you find it, but they are not the law.",
        "Always check that you are reading the version in force on the date that matters, and whether it has since been amended, repealed or interpreted by a court.",
      ],
      [
        `Place you entered: ${ctx.place}.`,
        "List the layers that could apply: national, state or regional, and local.",
        "Find one official source for each layer. Truth Weaver's Sources page shows where to start for some places.",
      ],
      [
        ["Is an AI summary of the law a primary source?", "No. It is at most a secondary aid. Only the law itself, read from an official source, is primary."],
        ["Why does the date matter when you read a law?", "Laws change. You need the version that was in force on the date that matters to your situation."],
      ],
    ),
    ...lesson(
      "Lesson 4: Evidence and records",
      [
        "Facts decide how the law applies. Keep the original notice and everything related to it together in one place.",
        "Keep copies of anything you send, and send important replies in a way that shows when they arrived. After a phone call or visit, write a short dated note of who you spoke with and what was said.",
        "Photographs, receipts, bank records, messages and contracts can all matter. Do not change originals; make copies to write on.",
      ],
      ["Start a records log today, on paper or using the Response Templates.", "List three documents that relate to this notice and where each one is."],
      [["What should you do after an important phone call about the notice?", "Write a short dated note of who you spoke with and what was said."]],
    ),
    ...lesson(
      "Lesson 5: Getting help",
      [
        "A lawyer licensed where your issue is governed can tell you what the law requires and what your options are. Many places also have legal aid organizations, lawyer referral services and court self-help centers.",
        "Before you call, prepare the notice, your timeline, your documents and your questions. Ask about fees, what the lawyer will and will not do, and the next deadline.",
        "Some lawyers offer help with only part of a matter. Ask whether that is available where you are.",
      ],
      [
        "Write your questions down before the first conversation.",
        ...result.questionsForCounsel.slice(0, 3).map((q) => `From your analysis: ${clean(q)}`),
      ],
      [["What three things should you bring to a first conversation with a lawyer?", "The notice, your timeline and documents, and your written questions."]],
    ),
    { type: "subheading", text: "Self-check answers" },
    { type: "numbered", items: qa.map(([q, a]) => `${q} Answer: ${a}`) },
  ];
  return {
    kind: "course",
    title: "Notice Basics Course",
    intro: "Five short lessons, in order. Each ends with an exercise that uses your own notice and a few self-check questions. The answers are at the end.",
    blocks,
  };
}

const BUILDERS: Record<ReportKind, (ctx: Ctx) => ReportPart> = {
  snapshot: snapshotPart,
  guide: guidePart,
  templates: templatesPart,
  course: coursePart,
};

export function buildPaidReport(input: PaidReportInput): PaidReportDocument {
  const kinds = reportKindsFor(input.offers);
  if (kinds.length === 0) throw new Error("No report parts for this order.");
  const { metadata, result } = input.stored;
  const ctx: Ctx = {
    stored: input.stored,
    place: describePlace(metadata),
    title: clean(metadata.documentTitle),
    issuer: clean(metadata.issuer),
    received: clean(metadata.receivedDate),
    docType: clean(metadata.documentType),
  };
  const orderNumber = input.orderId.split("/").pop() ?? "order";
  const reference = "TW-R-" + fingerprint(JSON.stringify({ order: input.orderId, metadata, generated: result.generatedAt }));
  const labels = offerLabels(input.offers);
  return {
    reference,
    title: "Truth Weaver Counsel",
    subtitle: ctx.title ? `${labels.join(" + ")}: ${ctx.title}` : labels.join(" + "),
    banner: [NOTICE_AUTHORITY.status, NOTICE_AUTHORITY.statement, "EDUCATIONAL RESEARCH AID", "NOT LEGAL ADVICE"],
    meta: [
      ["Order", clean(input.orderName)],
      ["Purchased", labels.join(", ")],
      ["Prepared", input.generatedAt.toISOString().slice(0, 10)],
      ["Analysis generated", clean(result.generatedAt) || "Not recorded"],
      ["Document", ctx.title || "Not supplied"],
      ["Place", ctx.place],
      ["Law status", "UNVERIFIED LAW"],
      ["Reference", reference],
    ],
    parts: kinds.map((kind) => BUILDERS[kind](ctx)),
    limits: [
      "Prepared only from the analysis saved to your account. It does not verify governing law, whether the notice is effective, any legal deadline, liability, or a remedy.",
      "AI extraction can miss or misread information. Compare every date, amount and name with the original notice.",
      "Confirm against current official sources and a qualified lawyer where your issue is governed. Governing law is the authority.",
      `This report belongs to order ${clean(input.orderName)} and your Truth Weaver account. It is not a receipt; Shopify holds your receipt.`,
      clean(result.authority.disclaimer),
    ],
    filename: `truth-weaver-report-${orderNumber}.pdf`,
  };
}
