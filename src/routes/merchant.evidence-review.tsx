import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { pageHead } from "@/lib/seo";
import { authed } from "@/lib/merchant/authed-call";
import { reviewProjectEvidence } from "@/lib/merchant/owner-intelligence.functions";
import { evidenceReviewInputSchema } from "@/lib/merchant/owner-intelligence";

export const Route = createFileRoute("/merchant/evidence-review")({
  head: () => pageHead({
    path: "/merchant/evidence-review",
    title: "Evidence Challenge | Truth Weaver",
    description: "Private advisory review of project claims, evidence gaps and the next verification gate.",
    noindex: true,
  }),
  component: EvidenceReviewPage,
});

type Evidence = { label: string; summary: string; sourceUrl: string };
type Review = Awaited<ReturnType<typeof reviewProjectEvidence>>;
const emptyEvidence = (): Evidence => ({ label: "", summary: "", sourceUrl: "" });

function EvidenceReviewPage() {
  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([emptyEvidence()]);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<Review | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = {
    claim,
    evidence: evidence.map((entry) => ({
      label: entry.label,
      summary: entry.summary,
      ...(entry.sourceUrl.trim() ? { sourceUrl: entry.sourceUrl.trim() } : {}),
    })),
  };
  const isValid = evidenceReviewInputSchema.safeParse(input).success;

  function changeEvidence(index: number, field: keyof Evidence, value: string) {
    setResult(null);
    setEvidence((prev) => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  }

  async function review() {
    setError(null);
    setResult(null);
    if (!consent || !isValid) return;
    setWorking(true);
    try {
      setResult(await authed(reviewProjectEvidence, input));
    } catch {
      setError("The AI Gateway review was unavailable. No claim was verified or authorized.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="max-w-4xl space-y-6" aria-labelledby="evidence-heading">
      <div>
        <h1 id="evidence-heading" className="font-serif text-3xl">Evidence challenge</h1>
        <p className="mt-2 text-sm text-parchment/70">
          Submit one project claim and the evidence you already have. The model identifies gaps,
          challenge questions and one next gate. This is an advisory review, never proof of correctness.
        </p>
      </div>
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void review(); }}>
        <label className="block text-sm font-semibold" htmlFor="claim">Claim to challenge</label>
        <textarea id="claim" value={claim} onChange={(event) => { setClaim(event.currentTarget.value); setResult(null); }}
          maxLength={3000} rows={4} required placeholder="e.g. All six public canonical pages are indexed by Google"
          className="w-full rounded-lg border border-gold/25 bg-forest-deep/40 p-3 text-parchment" />

        <div className="space-y-4">
          <h2 className="font-serif text-xl">Supporting evidence</h2>
          {evidence.map((entry, index) => (
            <fieldset key={index} className="space-y-2 rounded-xl border border-gold/20 p-4">
              <legend className="px-2 text-sm text-gold">Evidence {index + 1}</legend>
              <label className="block text-sm">Label
                <input value={entry.label} maxLength={120} required onChange={(event) => changeEvidence(index, "label", event.currentTarget.value)}
                  className="mt-1 block w-full rounded border border-gold/25 bg-ink p-2" placeholder="Search Console inspection" />
              </label>
              <label className="block text-sm">What this evidence actually shows
                <textarea value={entry.summary} maxLength={1600} required rows={3}
                  onChange={(event) => changeEvidence(index, "summary", event.currentTarget.value)}
                  className="mt-1 block w-full rounded border border-gold/25 bg-ink p-2"
                  placeholder="Exact observed result, date, property and source" />
              </label>
              <label className="block text-sm">HTTPS source link (optional)
                <input value={entry.sourceUrl} type="url" maxLength={1200} pattern="https://.*"
                  onChange={(event) => changeEvidence(index, "sourceUrl", event.currentTarget.value)}
                  className="mt-1 block w-full rounded border border-gold/25 bg-ink p-2" placeholder="https://…" />
              </label>
              {evidence.length > 1 && (
                <button type="button" className="text-sm text-gold underline"
                  onClick={() => { setEvidence((prev) => prev.filter((_, i) => i !== index)); setResult(null); }}>
                  Remove evidence
                </button>
              )}
            </fieldset>
          ))}
          {evidence.length < 8 && <button type="button" onClick={() => setEvidence((prev) => [...prev, emptyEvidence()])}
            className="rounded-full border border-gold/30 px-4 py-2 text-sm text-gold">Add evidence</button>}
        </div>
        <label className="flex items-start gap-3 text-sm text-parchment/75">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.currentTarget.checked)} className="mt-1" />
          <span>I understand this will send the entered claim and evidence text to the configured Cloudflare AI Gateway.
            Do not include passwords, secrets, confidential customer information or private legal records.</span>
        </label>
        <button type="submit" disabled={!isValid || !consent || working}
          className="rounded-full bg-gold px-6 py-2.5 font-semibold text-ink disabled:opacity-40">
          {working ? "Challenging evidence…" : "Analyze evidence gaps"}
        </button>
      </form>
      {error && <p role="alert" className="rounded-lg border border-danger/40 p-3 text-danger">{error}</p>}
      {result && (
        <div className="space-y-5 rounded-xl border border-gold/25 bg-forest-deep/30 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gold">Advisory · not verified</p>
          <p className="text-xs text-parchment/50">Model: {result.model} · Reviewed {result.reviewedAt}</p>
          <div><h2 className="font-serif text-xl">Evidence gaps</h2>
            {result.evidenceGaps.length ? <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{result.evidenceGaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>
              : <p className="mt-2 text-sm text-parchment/70">None suggested by the model; independent verification is still required.</p>}
          </div>
          <div><h2 className="font-serif text-xl">Attack questions</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{result.attackQuestions.map((question, i) => <li key={i}>{question}</li>)}</ol>
          </div>
          <div className="rounded-lg border border-gold/20 p-4">
            <h2 className="font-serif text-xl">Next verification gate</h2>
            <p className="mt-2 text-sm"><strong>Action:</strong> {result.nextGate.action}</p>
            <p className="mt-2 text-sm"><strong>Evidence needed:</strong> {result.nextGate.requiredProof}</p>
            <p className="mt-2 text-sm"><strong>Pass criterion:</strong> {result.nextGate.passCriterion}</p>
          </div>
          <p className="break-all text-xs text-parchment/45">Input SHA-256 fingerprint: {result.claimFingerprint} (identifier only; not proof)</p>
        </div>
      )}
    </section>
  );
}
