import { useRef, useState } from "react";
import { ArrowRight, Compass } from "lucide-react";

import { triageIssueWithAi, type AiTriageResult } from "@/lib/issue-triage.functions";

// Semantic AI routing only. Suggests where to start browsing; never states which law applies.
export function IssueTriageBanner() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<AiTriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  async function run() {
    if (text.trim().length < 3) {
      setResults(null);
      setError("Describe your problem in a few more words.");
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const ai = await triageIssueWithAi({ data: { text } });
      if (id !== reqId.current) return;
      setResults(ai);
    } catch {
      if (id !== reqId.current) return;
      setError("Our AI couldn't sort this right now.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }

  return (
    <div data-issue-triage className="mt-8 max-w-xl rounded-2xl border border-gold/35 bg-ink/70 p-4 backdrop-blur sm:p-5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gold">
        <Compass className="h-4 w-4" aria-hidden /> What's your legal issue?
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
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
        <button type="submit" disabled={loading} data-testid="triage-submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink disabled:opacity-60">
          {loading ? "Thinking…" : "Find my area"}
        </button>
      </form>
      {error ? (
        <div data-testid="triage-error" role="alert" className="mt-3 text-sm text-parchment/85">
          <p>
            {error}{" "}
            <button type="button" onClick={() => void run()} className="text-gold underline">Try again</button> or{" "}
            <a href="#legal-areas" className="text-gold underline">browse all 11 areas</a>.
          </p>
        </div>
      ) : null}
      {results ? (
        <div data-testid="triage-result" className="mt-3 text-sm text-parchment/85">
          {results.length === 0 ? (
            <p>No clear match. Try a few more words, or <a href="#legal-areas" className="text-gold underline">browse all 11 areas</a>.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((r) => (
                <li key={r.area}>
                  <a href={`/shop?area=${encodeURIComponent(r.area)}`} className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1.5 text-gold-soft hover:bg-gold/10">
                    {r.area} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <p className="mt-1 pl-3 text-xs text-parchment/60">{r.reason}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] leading-4 text-parchment/50">
            AI suggestion (inferred, non-authorizing). A starting point, not a legal conclusion. Governing law is the authority.{" "}
            <a href="#legal-research" className="text-gold underline">Research the law for your place</a>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
