import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { authed } from "@/lib/merchant/authed-call";
import { reviewClaimEvidence } from "@/lib/claim-review.functions";
import type { EvidenceReviewInput, ReviewResult } from "@/lib/claim-review";

export const Route = createFileRoute("/merchant/claim-review")({
  head: () => ({ meta: [{ title: "Claim Evidence Review | Truth Weaver" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ClaimReviewPage,
});

type Item = { label: string; detail: string; url: string };
const emptyItem = (): Item => ({ label: "", detail: "", url: "" });

function ClaimReviewPage() {
  const [claim, setClaim] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState("");

  const change = (i: number, field: keyof Item, value: string) => setItems(current =>
    current.map((item, j) => j === i ? { ...item, [field]: value } : item)
  );
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResult(null);
    try {
      const input: EvidenceReviewInput = {
        claim,
        evidence: items.map(item => ({
          label: item.label,
          detail: item.detail,
          ...(item.url.trim() ? { url: item.url.trim() } : {}),
        })),
        consent: true,
      };
      if (!consent) throw new Error("Confirm that you agree to send the entered claim and evidence to AI Gateway.");
      setResult(await authed(reviewClaimEvidence, input));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evidence review failed; no recommendation was issued.");
    } finally { setPending(false); }
  }

  return (
    <section aria-labelledby="claim-review-h" className="max-w-4xl space-y-5" data-testid="claim-evidence-review">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gold">Private owner evidence challenge</p>
        <h1 id="claim-review-h" className="mt-2 font-serif text-3xl">Claim & evidence review</h1>
        <p className="mt-2 text-sm text-parchment/70">Submit a claim and its supporting evidence for an adversarial gap review. The model proposes challenge questions and a next human verification gate. It cannot confirm facts, inspect linked sources, approve release, or publish content.</p>
      </div>
      <form onSubmit={review} className="space-y-5">
        <label className="block text-sm font-semibold">
          Claim
          <textarea required minLength={8} maxLength={1500} rows={4} value={claim} onChange={e => setClaim(e.currentTarget.value)} className="mt-2 w-full rounded-lg border border-gold/30 bg-forest-deep/30 p-3 text-parchment" placeholder="Exactly what is being claimed? Specify the subject, timeframe and scope." />
        </label>
        <div>
          <h2 className="font-serif text-xl">Supporting evidence</h2>
          <p className="mt-1 text-xs text-parchment/60">Provide up to six sources or observations. A URL is a user-provided reference, not an independently checked source.</p>
          <div className="mt-3 space-y-3">
            {items.map((item, i) => (
              <fieldset key={i} className="rounded-xl border border-gold/20 p-4">
                <legend className="px-2 text-sm text-gold">Evidence {i + 1}</legend>
                <label className="block text-sm">Source or observation name
                  <input required minLength={3} maxLength={120} value={item.label} onChange={e => change(i, "label", e.currentTarget.value)} className="mt-1 w-full rounded-md border border-gold/25 bg-ink p-2" />
                </label>
                <label className="mt-3 block text-sm">What does it actually prove?
                  <textarea required minLength={10} maxLength={1500} rows={3} value={item.detail} onChange={e => change(i, "detail", e.currentTarget.value)} className="mt-1 w-full rounded-md border border-gold/25 bg-ink p-2" />
                </label>
                <label className="mt-3 block text-sm">HTTPS source URL (optional)
                  <input type="url" maxLength={400} value={item.url} onChange={e => change(i, "url", e.currentTarget.value)} className="mt-1 w-full rounded-md border border-gold/25 bg-ink p-2" placeholder="https://" />
                </label>
                {items.length > 1 && <button type="button" onClick={() => setItems(current => current.filter((_, j) => j !== i))} className="mt-3 text-xs text-gold underline">Remove evidence</button>}
              </fieldset>
            ))}
          </div>
          {items.length < 6 && <button type="button" onClick={() => setItems(current => [...current, emptyItem()])} className="mt-3 rounded-full border border-gold/40 px-4 py-2 text-sm">Add another source</button>}
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-gold/20 p-4 text-sm text-parchment/80">
          <input type="checkbox" required checked={consent} onChange={e => setConsent(e.currentTarget.checked)} className="mt-1" />
          I agree to send these claim and evidence fields to AI Gateway for this review. Do not enter private customer records, credentials, or children's personal details. Inputs are not stored by this page.
        </label>
        <button disabled={pending || !consent} type="submit" className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink disabled:opacity-50">{pending ? "Reviewing…" : "Challenge evidence"}</button>
      </form>
      {error && <div role="alert" className="rounded-xl border border-danger/40 p-4 text-sm text-danger">{error}</div>}
      {result && <section aria-labelledby="review-results" data-testid="claim-review-results" className="space-y-4 rounded-2xl border border-gold/30 bg-forest-deep/30 p-5">
        <h2 id="review-results" className="font-serif text-2xl">Advisory review</h2>
        <p className="text-xs text-parchment/60">AI Gateway · {result.reviewedAt} · Fingerprint {result.fingerprint} · No verification or publication authority</p>
        <div><h3 className="font-semibold text-gold">Evidence gaps</h3>
          {result.gaps.length ? <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{result.gaps.map((x,i) => <li key={i}>{x.issue} — Needed: {x.neededProof}</li>)}</ul> : <p className="mt-1 text-sm text-parchment/70">No gaps identified by the model; this is not proof the claim is true.</p>}
        </div>
        <div><h3 className="font-semibold text-gold">Attack questions</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{result.attackQuestions.map((x,i) => <li key={i}>{x}</li>)}</ol></div>
        <div><h3 className="font-semibold text-gold">Recommended next human gate</h3>
          <p className="mt-1 text-lg">{result.nextGate.replace(/-/g, " ")}</p>
          <p className="mt-2 text-sm text-parchment/70">{result.gateReason}</p>
          <p className="mt-2 text-xs text-parchment/60">No action was approved, published or executed.</p>
        </div>
      </section>}
    </section>
  );
}
