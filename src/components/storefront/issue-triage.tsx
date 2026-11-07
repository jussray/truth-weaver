import { useEffect, useRef, useState } from "react";
import { ArrowRight, Compass } from "lucide-react";

import { triageIssueWithAi, type AiTriageResult } from "@/lib/issue-triage.functions";

// Classification is only a starting point. Research requires place, dates and sources.
export function IssueTriageBanner({ onContinue }: { onContinue: (description: string) => void }) {
  const [text, setText] = useState("");
  // SSR markup must not accept typing until client handlers preserve it.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [results, setResults] = useState<AiTriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const description = text.trim();
  const canContinue = description.length >= 3;

  async function run() {
    if (!canContinue) {
      setResults(null);
      setError("Tell us a little more about what happened.");
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const ai = await triageIssueWithAi({ data: { text: description } });
      if (id !== reqId.current) return;
      setResults(ai);
    } catch {
      if (id !== reqId.current) return;
      setError("Issue matching is unavailable right now. You can still continue with what you wrote.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }

  return (
    <div data-issue-triage className="mt-8 max-w-xl rounded-2xl border border-gold/35 bg-ink/70 p-4 backdrop-blur sm:p-5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gold">
        <Compass className="h-4 w-4" aria-hidden /> What's your legal issue?
      </p>
      <p className="mt-2 text-sm leading-6 text-parchment/75">
        Describe it in your own words. We'll help you find a starting point, then check the law for your location.
      </p>
      <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <label htmlFor="triage-input" className="sr-only">Describe your legal issue</label>
        <textarea
          id="triage-input"
          data-testid="triage-input"
          disabled={!ready}
          value={text}
          rows={2}
          maxLength={1200}
          onChange={(e) => {
            ++reqId.current;
            setText(e.currentTarget.value);
            setResults(null);
            setError(null);
            setLoading(false);
          }}
          placeholder="For example: My landlord kept my security deposit after I moved."
          className="w-full min-w-0 resize-y rounded-xl border border-parchment/15 bg-ink px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchment/35 focus:border-gold/60"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={loading || !ready} data-testid="triage-submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink disabled:opacity-60">
            {loading ? "Checking…" : "Find a starting point"}
          </button>
          {canContinue ? (
            <a
              href="#legal-research"
              data-testid="triage-continue"
              onClick={() => onContinue(description)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-soft underline-offset-4 hover:underline"
            >
              Continue with my description <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          ) : null}
        </div>
      </form>
      {loading ? <p role="status" className="mt-3 text-sm text-parchment/70">Looking for a useful starting point, not a legal verdict.</p> : null}
      {error ? (
        <p data-testid="triage-error" role="alert" className="mt-3 text-sm leading-6 text-parchment/85">
          {error} You can also <a href="#legal-areas" className="text-gold underline">browse the legal topics</a>.
        </p>
      ) : null}
      {results ? (
        <div data-testid="triage-result" role="status" className="mt-4 space-y-3 text-sm text-parchment/85">
          {results.length === 0 ? (
            <p>No reliable category match yet. You can continue with your own description.</p>
          ) : (
            <>
              <p className="font-semibold text-parchment">Your issue may involve:</p>
              <ul className="space-y-2">
                {results.map((result) => (
                  <li key={result.area} className="rounded-xl border border-gold/20 bg-gold/5 px-3 py-2">
                    <p className="font-semibold text-gold-soft">{result.area}</p>
                    <p className="mt-1 text-sm leading-5 text-parchment/75">{result.reason}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-xs leading-5 text-parchment/65">
            This identifies possible topics, not which law applies. Continue with your description, then add where and when it happened for source-based research.
          </p>
        </div>
      ) : null}
    </div>
  );
}
