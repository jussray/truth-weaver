/**
 * Public, jurisdiction-agnostic education for reading notices. This content is
 * independent of paid, account-bound documents, order proofs, and customer data.
 * A source link is a research pointer, NOT verification of law for a reader.
 */
import { REPORT_OFFERS, type ReportOfferKey } from "../commerce/report-catalog";

export type LearningKey = Exclude<ReportOfferKey, "snapshot">;
export type LearningSource = {
  id: string;
  title: string;
  url: string;
  scope: string;
  reviewedOn: string;
  status: "SOURCE_LINK_REVIEWED_NOT_LAW_VERIFIED";
};

export const LEARNING_SOURCES: readonly LearningSource[] = [
  {
    id: "federal-rules",
    title: "U.S. Courts: Current Rules of Practice & Procedure",
    url: "https://www.uscourts.gov/forms-rules/current-rules-practice-procedure",
    scope: "Federal court rules; check the actual court and its local rules",
    reviewedOn: "2026-11-19",
    status: "SOURCE_LINK_REVIEWED_NOT_LAW_VERIFIED",
  },
  {
    id: "civil-forms",
    title: "U.S. Courts: Civil Forms",
    url: "https://www.uscourts.gov/forms-rules/forms/civil-forms",
    scope: "Examples of official federal court forms; not a state court filing resource",
    reviewedOn: "2026-11-19",
    status: "SOURCE_LINK_REVIEWED_NOT_LAW_VERIFIED",
  },
  {
    id: "legal-aid",
    title: "USAGov: Find affordable legal aid",
    url: "https://www.usa.gov/legal-aid",
    scope: "Finding free or low-cost legal help in the United States",
    reviewedOn: "2026-11-19",
    status: "SOURCE_LINK_REVIEWED_NOT_LAW_VERIFIED",
  },
  {
    id: "debt-notices",
    title: "CFPB: What to do when a debt collector contacts you",
    url: "https://www.consumerfinance.gov/ask-cfpb/what-should-i-do-when-a-debt-collector-contacts-me-en-1695/",
    scope: "U.S. consumer debt-collection example; not a rule for every notice",
    reviewedOn: "2026-11-19",
    status: "SOURCE_LINK_REVIEWED_NOT_LAW_VERIFIED",
  },
] as const;

export type LearningSection = {
  id: string;
  title: string;
  text: readonly string[];
  actions: readonly string[];
  sourceIds: readonly string[];
};

export const NOTICE_GUIDE: readonly LearningSection[] = [
  {
    id: "identify",
    title: "1. Identify the sender and document",
    text: [
      "A letter from a private company, an agency notice, and a court filing are not interchangeable. Begin by recording who sent the document and what authority it claims. Do not assume the title alone tells you its legal effect.",
      "Look for a case number, court or agency name, document date, address, and response instructions. Verify unfamiliar contact information through an independently located official website.",
    ],
    actions: ["Record the document title, sender, case or reference number, and how it reached you.", "Keep the original document and any envelope or delivery record."],
    sourceIds: ["civil-forms"],
  },
  {
    id: "dates",
    title: "2. Separate stated dates from verified deadlines",
    text: [
      "Make a timeline of the date printed on the document, when it was sent, when you received it, and any response or hearing date it claims. A date on a document is not, by itself, proof that the date is legally correct.",
      "Applicable rules can depend on the jurisdiction, kind of proceeding, service method, and actual event. Do not guess how days are counted. Seek prompt qualified help for time-sensitive matters.",
    ],
    actions: ["Enter every stated date in a tracker marked UNVERIFIED.", "Find the official court, agency, or statute governing the specific date before treating it as a deadline."],
    sourceIds: ["federal-rules"],
  },
  {
    id: "claims",
    title: "3. Distinguish what is alleged from what is established",
    text: [
      "Mark each claimed fact, request, amount, and consequence. Keep the sender's assertions separate from records that corroborate them and from legal conclusions.",
      "A debt-collection validation notice, for example, differs from a court summons. Use subject-specific official guidance instead of applying a generic response rule to every paper.",
    ],
    actions: ["For each request, note the exact passage supporting it.", "Write down what you can document, what conflicts, and what remains unknown."],
    sourceIds: ["debt-notices", "civil-forms"],
  },
  {
    id: "authority",
    title: "4. Locate the correct official authority",
    text: [
      "Start with jurisdiction: federal, state, local, tribal, territorial, or another applicable system. Search that government's official statutes, regulations, court rules, or agency instructions.",
      "Check the version in force for the relevant time, not merely the newest search result. An AI answer, legal blog, or a link in this guide cannot promote an unverified claim to governing law.",
    ],
    actions: ["Record the official URL, title or citation, jurisdiction, and date checked.", "Identify contrary or missing authority and note whether a qualified reviewer is needed."],
    sourceIds: ["federal-rules"],
  },
  {
    id: "records",
    title: "5. Make an evidence and communications log",
    text: [
      "Preserve originals. Keep organized copies of notices, leases, contracts, receipts, messages, photographs, and other relevant records. Record what happened rather than guessing why someone acted.",
      "Before sending a letter, making an admission, paying, signing an agreement, or filing a form, check which response is appropriate. A request for information may not change any formal deadline.",
    ],
    actions: ["Use the record log template for each new communication.", "Keep copies and proof of sending or receiving important communications."],
    sourceIds: ["civil-forms"],
  },
  {
    id: "help",
    title: "6. Prepare for legal help",
    text: [
      "A qualified professional or a local court self-help service can help distinguish the correct forms and deadlines. Eligibility for legal aid varies by location and program.",
      "Bring a short timeline, the notice, supporting records, and a list of unresolved questions. Ask about any immediate response deadline and whether you need a formal filing.",
    ],
    actions: ["Find local legal aid or a lawyer licensed where the matter is governed.", "Ask what needs immediate attention, what is unknown, and which official form or rule applies."],
    sourceIds: ["legal-aid", "civil-forms"],
  },
] as const;

export type LearningTemplate = {
  id: string;
  title: string;
  instructions: string;
  fields: readonly string[];
  caution: string;
  sourceIds: readonly string[];
};

export const NOTICE_TEMPLATES: readonly LearningTemplate[] = [
  {
    id: "date-tracker",
    title: "Stated-date and deadline tracker",
    instructions: "Use one entry per date; keep the official-rule column blank until independently checked.",
    fields: ["Date stated in document", "What the sender says happens", "How and when notice was received", "Official rule / source URL", "Verified deadline (if checked by counsel)", "Next action"],
    caution: "This is a planning worksheet, not a legal deadline calculator.",
    sourceIds: ["federal-rules"],
  },
  {
    id: "record-log",
    title: "Records and communications log",
    instructions: "Record facts soon after each interaction, with copies of the originals preserved separately.",
    fields: ["Date and time", "Person or organization", "Method (email, mail, call, visit)", "What was sent or said", "Where proof is stored", "Questions still open"],
    caution: "Do not include sensitive personal details in shared or public copies.",
    sourceIds: [],
  },
  {
    id: "notice-map",
    title: "Claim, evidence, and source map",
    instructions: "Separate the document's claims from your records and from any verified official authority.",
    fields: ["Exact claim or demand", "Document page / passage", "Evidence for or against", "Jurisdiction", "Official authority URL and date", "Status: unknown / disputed / counsel reviewed"],
    caution: "A claim does not become verified law because a source link was added.",
    sourceIds: ["federal-rules", "debt-notices"],
  },
  {
    id: "counsel-intake",
    title: "Lawyer or legal-aid intake sheet",
    instructions: "Prepare a brief, factual account and keep the notice and evidence ready for a confidential discussion.",
    fields: ["Document type and sender", "When and how received", "Immediate dates written on it", "What outcome you want", "Questions for counsel", "Documents available"],
    caution: "This worksheet is not an official court form or a filing.",
    sourceIds: ["legal-aid", "civil-forms"],
  },
] as const;

export type LearningLesson = {
  number: number;
  title: string;
  objective: string;
  reading: readonly string[];
  exercise: string;
  question: string;
  answer: string;
  sourceIds: readonly string[];
};

export const NOTICE_LESSONS: readonly LearningLesson[] = [
  {
    number: 1,
    title: "Read the document without jumping to conclusions",
    objective: "Identify the sender, type, claimed demand, and document identifiers.",
    reading: ["Start with observable facts: title, sender, recipient, identifiers, dates, and stated consequences.", "Court papers and private letters can require very different responses. An unfamiliar title is a reason to verify, not to guess."],
    exercise: "On a practice copy or on paper, mark the sender, requested action, and every referenced case number.",
    question: "Does a private letter's demand automatically establish that the sender is correct?",
    answer: "No. It is an assertion that needs the applicable facts and law to be evaluated.",
    sourceIds: ["civil-forms"],
  },
  {
    number: 2,
    title: "Build a timeline, not a guessed deadline",
    objective: "Track multiple stated dates without treating them as verified law.",
    reading: ["Separate the written date, sent date, received date, and requested response date.", "Whether a period is measured in business days, calendar days, or from service depends on the governing rules."],
    exercise: "Write each date in the tracker and label the deadline column 'Not verified' until an official rule is checked.",
    question: "Can the phrase 'within ten days' alone prove when an answer must be filed?",
    answer: "No. The applicable procedure and the event that starts the period must be checked.",
    sourceIds: ["federal-rules"],
  },
  {
    number: 3,
    title: "Find primary sources and notice the gaps",
    objective: "Distinguish official law sources from explainers.",
    reading: ["Search the legislature, judiciary, or regulator of the place involved for rules and forms.", "A source index or AI summary is only a research pointer; it does not establish that a specific rule applies to your situation."],
    exercise: "Record the title, URL, issuing authority, jurisdiction, and checked date of one official source.",
    question: "Can an AI-generated explanation replace an official rule or qualified legal advice?",
    answer: "No. Use it to find questions and sources, then check the actual governing authority.",
    sourceIds: ["federal-rules", "civil-forms"],
  },
  {
    number: 4,
    title: "Organize records and communications",
    objective: "Preserve originals and build an evidence trail.",
    reading: ["Keep original documents intact and store copies where you can retrieve them.", "Record the date, parties, method, and substance of significant communications without adding unverified assumptions."],
    exercise: "Complete one sample row of the communication log using fictitious information.",
    question: "What should you preserve after sending an important document?",
    answer: "A copy of what you sent and any available proof of transmission or delivery.",
    sourceIds: [],
  },
  {
    number: 5,
    title: "Ask informed questions and choose a safe next step",
    objective: "Prepare to speak with a lawyer, legal aid, or an appropriate court self-help service.",
    reading: ["Bring the notice, timeline, questions, and relevant records.", "Ask which jurisdiction and procedure apply, whether a formal filing is required, and how to confirm the actual deadline."],
    exercise: "List three questions to ask about your specific notice, including any time-sensitive item.",
    question: "Why is it risky to assume that requesting information stops a court deadline?",
    answer: "Different procedures have different requirements; a request might not alter any legal obligation or filing deadline.",
    sourceIds: ["legal-aid", "civil-forms"],
  },
] as const;

export const PUBLIC_MATERIAL_STATUS = "EDUCATIONAL SAMPLE · NOT A PAID DELIVERABLE · NOT LEGAL ADVICE";
export const LEARNING_KEYS: readonly LearningKey[] = ["guide", "templates", "course", "bundle"];

/** Portable read-only research workflow. Adapters are NOT connected by this definition. */
export const LEARNING_RESEARCH_WORKFLOW = {
  schema: "truthweaver/education-source-review@v1",
  name: "Notice education research and editorial export",
  execution: "MANUAL_OR_GOVERNED_TRIGGER_ONLY",
  supportedAdapters: ["Exa research", "GitHub version control", "GitBook Markdown", "Cloudflare Workflows review adapter"],
  adaptersConnected: false,
  scope: "General U.S. legal information; no jurisdiction-specific rulings or advice",
  steps: [
    { id: "discover", action: "Find primary official source and jurisdiction", owner: "research", proof: "URL, title, issuer and retrieved date" },
    { id: "verify", action: "Check authenticity, effective date and contrary authority", owner: "source-review", proof: "Exact source quote/citation and uncertainty record" },
    { id: "draft", action: "Write educational explanation and exercises", owner: "editorial", proof: "Versioned diff and source map" },
    { id: "redteam", action: "Check deadlines, scope, missing facts and unsupported claims", owner: "independent-review", proof: "Recorded finding and disposition" },
    { id: "review", action: "Explicit qualified editor and founder publication approval", owner: "human", proof: "Approval receipt bound to exact content SHA" },
    { id: "export", action: "Export GitBook-ready Markdown, PDF or audit JSON", owner: "publisher", proof: "Artifact hash and target readback" },
  ],
  gates: {
    autoPublish: false,
    autoSell: false,
    autoFileLegalDocuments: false,
    requireOfficialSource: true,
    requireJurisdictionCheck: true,
    requireHumanPublicationApproval: true,
    requireVerifiedDeliveryBeforeSale: true,
  },
} as const;

function sourceLines(ids: readonly string[]): string[] {
  return ids.map((id) => {
    const source = LEARNING_SOURCES.find((entry) => entry.id === id);
    return source ? `Source to check: ${source.title} — ${source.url} (${source.scope})` : `Unresolved source: ${id}`;
  });
}

export function learningResourceMarkdown(key: LearningKey): string {
  if (!LEARNING_KEYS.includes(key)) throw new Error("Unknown educational resource");
  const offer = REPORT_OFFERS[key];
  const head = [`# ${offer.label}: educational sample`, "", PUBLIC_MATERIAL_STATUS, "", offer.summary, "", "This is not a personalized paid report or official form. Confirm jurisdiction, dates, and legal effect with official sources and qualified counsel.", ""];
  const guide = NOTICE_GUIDE.flatMap((s) => [`## ${s.title}`, ...s.text, "", "Try this:", ...s.actions.map((x) => `- ${x}`), ...sourceLines(s.sourceIds), ""]);
  const templates = NOTICE_TEMPLATES.flatMap((t) => [`## ${t.title}`, t.instructions, "", ...t.fields.map((f) => `- [ ] ${f}: __________________`), "", t.caution, ...sourceLines(t.sourceIds), ""]);
  const lessons = NOTICE_LESSONS.flatMap((l) => [`## Lesson ${l.number}: ${l.title}`, `Goal: ${l.objective}`, ...l.reading, "", `Exercise: ${l.exercise}`, `Self-check: ${l.question}`, `Answer: ${l.answer}`, ...sourceLines(l.sourceIds), ""]);
  const items = key === "guide" ? guide : key === "templates" ? templates : key === "course" ? lessons : [
    "## What's in the planned bundle", "Notice Snapshot is a separately verified, buyer-specific paid output. It is not reproduced here.", "The free educational samples below do not prove any purchase or unlock fulfillment.", "",
    ...guide, ...templates, ...lessons,
  ];
  return [...head, ...items, "## Official source index", ...LEARNING_SOURCES.map((source) => `- ${source.title}: ${source.url} (${source.scope}; link reviewed ${source.reviewedOn}; legal applicability not verified)`), "", "No auto-publication, legal filing, or sale is authorized by this educational sample.", ""].join("\n");
}

export function learningWorkflowJson(): string {
  return JSON.stringify({ ...LEARNING_RESEARCH_WORKFLOW, sources: LEARNING_SOURCES, catalogSkus: LEARNING_KEYS.map((key) => REPORT_OFFERS[key].sku) }, null, 2) + "\n";
}
