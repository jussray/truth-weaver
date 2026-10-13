import { useState } from "react";
import { ArrowRight, Compass } from "lucide-react";

// Deterministic keyword routing only. This suggests where to start browsing;
// it never states which law applies.
const AREA_KEYWORDS: [string, string[]][] = [
  ["Housing & Real Estate", ["rent", "landlord", "tenant", "evict", "lease", "mortgage", "house", "apartment", "property", "deposit", "foreclos", "hoa"]],
  ["Credit & Debt", ["debt", "credit", "collector", "collection", "loan", "bankrupt", "repossess", "garnish", "score", "card"]],
  ["Family & Relationships", ["divorce", "custody", "child support", "marriage", "spouse", "adopt", "alimony", "visitation", "guardian", "will", "estate"]],
  ["Business & Entrepreneurship", ["business", "llc", "startup", "company", "trademark", "license", "permit", "partner", "incorporat", "tax"]],
  ["Contracts & Agreements", ["contract", "agreement", "signed", "breach", "terms", "refund", "warranty", "invoice", "nda"]],
  ["Criminal Law", ["arrest", "police", "charged", "criminal", "court date", "dui", "probation", "bail", "warrant", "ticket"]],
  ["Health & Disability", ["disability", "medical", "insurance", "hospital", "medicaid", "medicare", "accommodat", "ssi", "ssdi", "health"]],
  ["Immigration", ["visa", "immigra", "green card", "deport", "asylum", "citizenship", "passport", "work permit", "uscis"]],
  ["Government & Civil Rights", ["discriminat", "civil rights", "government", "benefits", "vote", "public records", "foia", "agency", "protest"]],
  ["Employment & Workplace", ["job", "fired", "boss", "employer", "wage", "overtime", "paycheck", "harass", "workplace", "unemployment", "layoff"]],
  ["International Law", ["international", "treaty", "abroad", "cross-border", "foreign", "embassy", "overseas"]],
];

export function triageIssue(text: string): { area: string; hits: string[] }[] {
  const t = text.toLowerCase();
  return AREA_KEYWORDS.map(([area, kws]) => ({ area, hits: kws.filter((k) => t.includes(k)) }))
    .filter((r) => r.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length)
    .slice(0, 3);
}

export function IssueTriageBanner() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<{ area: string; hits: string[]; reason?: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "keyword">("ai");

  return (
    <div data-issue-triage className="mt-8 max-w-xl rounded-2xl border border-gold/35 bg-ink/70 p-4 backdrop-blur sm:p-5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gold">
        <Compass className="h-4 w-4" aria-hidden /> What's your legal issue?
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (text.trim().length < 3) return setResults([]);
          setLoading(true);
          try {
            const ai = await triageIssueWithAi({ data: { text } });
            setMode("ai");
            setResults(ai.map((a) => ({ area: a.area, hits: [], reason: a.reason })));
          } catch {
            setMode("keyword");
            setResults(triageIssue(text));
          } finally {
            setLoading(false);
          }
        }}
      >
        <label htmlFor="triage-input" className="sr-only">Describe your problem</label>
        <input
          id="triage-input"
          data-testid="triage-input"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder="e.g. My landlord kept my deposit"
          className="min-w-0 flex-1 rounded-full border border-parchment/15 bg-ink px-4 py-2.5 text-sm text-parchment outline-none placeholder:text-parchment/35 focus:border-gold/60"
        />
        <button type="submit" data-testid="triage-submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink">
          Find my area
        </button>
      </form>
      {results ? (
        <div data-testid="triage-result" className="mt-3 text-sm text-parchment/85">
          {results.length === 0 ? (
            <p>No clear match. Try a few more words, or <a href="#legal-areas" className="text-gold underline">browse all 11 areas</a>.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {results.map((r) => (
                <li key={r.area}>
                  <a href={`/shop?area=${encodeURIComponent(r.area)}`} className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1.5 text-gold-soft hover:bg-gold/10">
                    {r.area} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] leading-4 text-parchment/50">
            Keyword match only. This is a starting point, not a legal conclusion. Governing law is the authority.{" "}
            <a href="#legal-research" className="text-gold underline">Research the law for your place</a>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
