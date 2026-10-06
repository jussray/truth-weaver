import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import { evaluateVerifiedLaw } from "@/domain/law";
import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server";
import {
  historicalVersionRequired,
  legalNavigatorModelOutputSchema,
  parseLegalNavigatorModelText,
  resolveJurisdictionHint,
  sourceRegistryForUrl,
  type LegalNavigatorInput,
} from "./legal-navigator";
import { relevantLegalBooks } from "./legal-books";
import {
  createContinuityMarker,
  hashSensitiveText,
  type ResearchFingerprintEvidence,
} from "./continuity";

const MODEL = "openai/gpt-6-astra";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const RESEARCH_VERSION = "legal-navigator.v1";

type CheckedSource = {
  url: string;
  title: string | null;
  sourceType: string;
  sourceRole: string;
  authorityClass: "PRIMARY LAW" | "DISCOVERY";
  jurisdiction: string;
  issuingBody: string;
  isOfficial: boolean;
  retrieved: boolean;
  retrievalStatus: string;
  retrievedAt: string | null;
  currentText: boolean;
  bodyText: string;
};

function runtimeVersion() {
  return (
    process.env["VERCEL_GIT_COMMIT_SHA"] ||
    process.env["GITHUB_SHA"] ||
    process.env["LOVABLE_GIT_COMMIT_SHA"] ||
    "runtime-unbound"
  );
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function htmlToSearchText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .slice(0, 500_000)
    .toLowerCase();
}

function citationAppearsInText(citation: string | null, text: string) {
  if (!citation || !text) return false;
  const normalizedCitation = citation
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = normalizedCitation
    .split(/\s+/)
    .filter((token) => token.length >= 3 || /^\d+$/.test(token));
  if (tokens.length < 2) return false;
  const significant = tokens.slice(-4);
  return significant.every((token) => text.includes(token));
}

async function checkSource(url: string, title: string | null): Promise<CheckedSource | null> {
  const registry = sourceRegistryForUrl(url);
  if (!registry) return null;

  let retrieved = false;
  let retrievalStatus = "not fetched";
  let bodyText = "";
  let retrievedAt: string | null = null;

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.8,*/*;q=0.5",
        "User-Agent": "TruthWeaver/1.0 legal-source-verifier",
      },
      signal: AbortSignal.timeout(8_000),
    });
    retrievalStatus = String(response.status) + " " + response.statusText;
    if (response.ok) {
      retrieved = true;
      retrievedAt = new Date().toISOString();
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text") || contentType.includes("html") || contentType.includes("json")) {
        bodyText = htmlToSearchText(await response.text());
      }
    }
  } catch (error) {
    retrievalStatus = error instanceof Error ? error.message : "source fetch failed";
  }

  return {
    url: normalizeUrl(url),
    title,
    sourceType: registry.sourceType,
    sourceRole: registry.sourceRole,
    authorityClass: registry.sourceRole === "primary" ? "PRIMARY LAW" : "DISCOVERY",
    jurisdiction: registry.jurisdiction,
    issuingBody: registry.issuingBody,
    isOfficial: true,
    retrieved,
    retrievalStatus,
    retrievedAt,
    currentText: registry.currentText,
    bodyText,
  };
}

function visibleSource(source: CheckedSource) {
  const { bodyText: _bodyText, ...visible } = source;
  return visible;
}

async function failClosed(
  input: LegalNavigatorInput,
  status: "JURISDICTION UNKNOWN" | "LIVE_RETRIEVAL_UNAVAILABLE",
  message: string,
) {
  const jurisdiction = resolveJurisdictionHint(input.place);
  const questionHash = await hashSensitiveText(input.question + "\n" + input.facts);
  const evidence: ResearchFingerprintEvidence = {
    repo: "jussray/truth-weaver",
    branch: "main",
    codeVersion: runtimeVersion(),
    researchVersion: RESEARCH_VERSION,
    normalizedQuestionHash: questionHash,
    jurisdiction: jurisdiction.layers,
    eventDate: input.eventDate || null,
    asOfDate: input.asOfDate || null,
    sourceEvidence: [],
    findingStates: [status],
  };
  const continuity = await createContinuityMarker(evidence, {
    predecessor: input.predecessorFingerprint || null,
  });

  return {
    researchStatus: status,
    generatedAt: new Date().toISOString(),
    model: null,
    jurisdiction,
    jurisdictionSummary: message,
    issues: [],
    findings: [],
    sources: [],
    books: relevantLegalBooks(input.question),
    missingFacts: jurisdiction.missing,
    procedureAndDeadlines: [],
    options: [],
    nextResearch: [message],
    continuity,
    authority: {
      status: "NON-AUTHORIZING" as const,
      statement: "GOVERNING LAW IS THE AUTHORITY" as const,
    },
  };
}

export async function researchLegalSituationOnServer(input: LegalNavigatorInput) {
  const jurisdiction = resolveJurisdictionHint(input.place);

  if (jurisdiction.status === "JURISDICTION UNKNOWN" || jurisdiction.allowedDomains.length === 0) {
    return failClosed(
      input,
      "JURISDICTION UNKNOWN",
      jurisdiction.missing[0] || "The governing jurisdiction is not resolved.",
    );
  }

  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  if (!lovableApiKey) {
    return failClosed(
      input,
      "LIVE_RETRIEVAL_UNAVAILABLE",
      "Live legal retrieval is unavailable because the AI gateway is not configured. Truth Weaver will not answer from model memory.",
    );
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

  let result;
  try {
    result = await generateText({
      model: provider.responses(MODEL),
      tools: {
        web_search: provider.tools.webSearch({
          externalWebAccess: true,
          searchContextSize: "high",
          filters: { allowedDomains: jurisdiction.allowedDomains },
        }),
      },
      system:
        "You are Truth Weaver's source-bound legal research assistant. Governing law is the authority. You MUST use live web search before making any legal proposition. Search official sources first and only use URLs actually returned or opened by the web-search tool. Never invent a statute, case, citation, URL, deadline, remedy, legal conclusion, effective date, or jurisdiction. Distinguish law from guidance and from inference. Books and commentary are secondary unless the governing legal system gives the specific publication legal force. If the source record is incomplete, say so. Return neutral legal-navigation research, not representation or a filing.",
      prompt:
        "Research this legal situation.\n\n" +
        "QUESTION / GOAL: " +
        input.question +
        "\nPLACE / JURISDICTION HINT: " +
        input.place +
        "\nRESOLVED CANDIDATE LAYERS: " +
        jurisdiction.layers.join(" > ") +
        "\nEVENT DATE: " +
        (input.eventDate || "not supplied") +
        "\nAS-OF DATE: " +
        (input.asOfDate || "current unless the issue requires historical law") +
        "\nFACTS: " +
        (input.facts || "not supplied") +
        "\n\nSearch only the registered official domains made available by the tool. If a state/province/local fact is missing, surface it instead of guessing. For historical events, identify the need for the law/version in force at that time.\n\nReturn ONLY one JSON object matching this shape:\n" +
        JSON.stringify({
          jurisdictionSummary: "what jurisdiction layers appear relevant and any limit",
          issues: ["legal issue detected"],
          findings: [
            {
              proposition: "one legal proposition",
              explanation: "plain-English explanation limited to retrieved authority",
              citation: "exact citation/official identifier or null",
              authorityType: "statute/regulation/case/ordinance/etc",
              issuingBody: "issuer/court or null",
              sourceUrls: ["exact URL returned by web search"],
              effectiveDate: "date/version if the source establishes it, otherwise null",
              currentnessNote: "what was checked about currency/as-of status, or null",
              contraryAuthority: "contrary/superseding authority found, not yet checked, or null",
            },
          ],
          missingFacts: ["facts that could change the legal result"],
          procedureAndDeadlines: ["only source-backed procedure/deadline, otherwise say it needs verification"],
          options: ["neutral navigation option, not a command or legal representation"],
          nextResearch: ["specific unresolved research step"],
        }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "high",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
  } catch {
    return failClosed(
      input,
      "LIVE_RETRIEVAL_UNAVAILABLE",
      "Live legal retrieval failed. Truth Weaver did not substitute model memory for current law.",
    );
  }

  let parsed;
  try {
    parsed = parseLegalNavigatorModelText(result.text);
  } catch {
    return failClosed(
      input,
      "LIVE_RETRIEVAL_UNAVAILABLE",
      "Live legal retrieval returned an invalid research record, so no legal conclusion was promoted.",
    );
  }

  const rawSources = (result.sources || []) as Array<{
    sourceType?: string;
    url?: string;
    title?: string;
  }>;
  const discovered = rawSources
    .filter((source) => source.sourceType === "url" && source.url)
    .map((source) => ({ url: normalizeUrl(source.url || ""), title: source.title || null }));

  if (discovered.length === 0) {
    return failClosed(
      input,
      "LIVE_RETRIEVAL_UNAVAILABLE",
      "The model returned no live URL sources, so Truth Weaver refused to treat the answer as legal research.",
    );
  }

  const checked = (
    await Promise.all(discovered.map((source) => checkSource(source.url, source.title)))
  ).filter((source): source is CheckedSource => Boolean(source));

  const checkedByUrl = new Map(checked.map((source) => [normalizeUrl(source.url), source]));
  const historical = historicalVersionRequired(input);
  const checkedAt = new Date().toISOString();

  const findings = parsed.findings.map((finding) => {
    const referenced = finding.sourceUrls
      .map((url) => checkedByUrl.get(normalizeUrl(url)))
      .filter((source): source is CheckedSource => Boolean(source));

    const citationVerified = referenced.some((source) =>
      citationAppearsInText(finding.citation, source.bodyText),
    );
    const currentnessChecked = !historical && referenced.some(
      (source) => source.retrieved && source.currentText,
    );

    const guard = evaluateVerifiedLaw({
      jurisdictionId: jurisdiction.layers.join(" > ") || null,
      sources: referenced.map((source) => ({
        source_type: source.sourceType,
        source_role: source.sourceRole,
        is_official: source.isOfficial,
        is_authentic: source.isOfficial,
        jurisdiction_id: source.jurisdiction,
      })),
      citation: finding.citation,
      officialStatusKnown: referenced.length > 0,
      currentnessCheckedAt: currentnessChecked ? checkedAt : null,
      asOfDate: input.asOfDate || input.eventDate || null,
    });

    const blockers = [...guard.blockers];
    let truthState = guard.resolvedState;

    if (guard.allowed && !citationVerified) {
      truthState = "UNVERIFIED LAW";
      blockers.push("The proposed citation was not independently matched in retrieved source text.");
    }
    if (historical) {
      truthState = truthState === "VERIFIED LAW" ? "STALE" : truthState;
      blockers.push("Historical event detected: the version of law in force on the relevant date still needs explicit verification.");
    }
    if (referenced.length === 0) {
      truthState = "UNVERIFIED LAW";
      blockers.push("No model-cited URL matched the live registered source set.");
    }

    return {
      ...finding,
      truthState,
      blockers: Array.from(new Set(blockers)),
      citationVerified,
      sources: referenced.map(visibleSource),
    };
  });

  const findingStates = findings.map((finding) => finding.truthState);
  const questionHash = await hashSensitiveText(input.question + "\n" + input.facts);
  const sourceEvidence = checked
    .map((source) => ({
      url: source.url,
      citation: null,
      sourceType: source.sourceType,
      authorityClass: source.authorityClass,
      retrievedAt: source.retrievedAt,
      currentnessEvidence:
        source.retrieved && source.currentText && !historical
          ? "Live official current-text source retrieved."
          : null,
    }))
    .sort((a, b) => a.url.localeCompare(b.url));

  const continuity = await createContinuityMarker(
    {
      repo: "jussray/truth-weaver",
      branch: "main",
      codeVersion: runtimeVersion(),
      researchVersion: RESEARCH_VERSION,
      normalizedQuestionHash: questionHash,
      jurisdiction: jurisdiction.layers,
      eventDate: input.eventDate || null,
      asOfDate: input.asOfDate || null,
      sourceEvidence,
      findingStates,
    },
    { predecessor: input.predecessorFingerprint || null },
  );

  return {
    researchStatus: findings.some((finding) => finding.truthState === "VERIFIED LAW")
      ? ("VERIFIED_SOURCES" as const)
      : ("PARTIAL" as const),
    generatedAt: new Date().toISOString(),
    model: MODEL,
    jurisdiction,
    jurisdictionSummary: parsed.jurisdictionSummary,
    issues: parsed.issues,
    findings,
    sources: checked.map(visibleSource),
    books: relevantLegalBooks(input.question),
    missingFacts: Array.from(new Set([...jurisdiction.missing, ...parsed.missingFacts])),
    procedureAndDeadlines: parsed.procedureAndDeadlines,
    options: parsed.options,
    nextResearch: parsed.nextResearch,
    continuity,
    authority: {
      status: "NON-AUTHORIZING" as const,
      statement: "GOVERNING LAW IS THE AUTHORITY" as const,
    },
  };
}

export const legalNavigatorServerSchema = legalNavigatorModelOutputSchema;
