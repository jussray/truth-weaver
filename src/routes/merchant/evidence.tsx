import { createFileRoute } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { pageHead } from '@/lib/seo';
import { authed } from '@/lib/merchant/authed-call';
import { reviewOwnerEvidence } from '@/lib/owner-review.functions';
import type { EvidenceReview, EvidenceItem } from '@/lib/owner-review';

export const Route = createFileRoute('/merchant/evidence')({
  head: () => pageHead({ path: '/merchant/evidence', title: 'Evidence Challenge | Owner | Truth Weaver', description: 'Private AI-assisted evidence gap review.', noindex: true }),
  component: EvidenceChallenge,
});
function EvidenceChallenge() {
  const [claim, setClaim] = useState('');
  const [evidence, setEvidence] = useState<EvidenceItem[]>([{ description: '', sourceUrl: '' }]);
  const [review, setReview] = useState<EvidenceReview | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (i: number, key: keyof EvidenceItem, value: string) => {
    setEvidence((old) => old.map((e, j) => i === j ? { ...e, [key]: value } : e)); setReview(null);
  };
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setReview(null);
    try {
      const r = await authed(reviewOwnerEvidence, { claim, evidence: evidence.filter((e) => e.description.trim()) });
      setReview(r.review); setRunId(r.runId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Evidence review failed. No conclusion generated.'); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-4xl space-y-6">
    <header><p className="text-xs uppercase tracking-[.2em] text-gold">Owner intelligence · private</p>
      <h1 className="mt-1 font-serif text-3xl">Evidence challenge</h1>
      <p className="mt-2 text-sm text-parchment/70">Submit a claim and the evidence you have. The model checks for missing proof, adversarial questions and the next verification gate. It cannot establish truth, verify legal authority or approve an action. Inputs are sent to the AI provider for processing.</p>
    </header>
    <form onSubmit={(e) => void submit(e)} className="space-y-5 rounded-2xl border border-gold/20 bg-forest-deep/40 p-5">
      <label className="block space-y-2"><span className="font-semibold">Claim to examine</span>
        <textarea required maxLength={2500} value={claim} onChange={(e) => {setClaim(e.target.value); setReview(null);}} placeholder="State one specific, falsifiable claim with its scope and date." className="min-h-28 w-full rounded-lg border border-gold/30 bg-ink p-3 text-parchment" /></label>
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Supporting evidence</h2>
        <button type="button" disabled={evidence.length >= 10} onClick={() => setEvidence((old) => [...old, {description:'',sourceUrl:''}])} className="rounded-full border border-gold/40 px-3 py-1 text-sm disabled:opacity-40">Add item</button>
      </div>
      {evidence.map((item, i) => <fieldset key={i} className="space-y-3 rounded-lg border border-parchment/10 p-3">
        <legend className="px-2 text-xs text-gold">Evidence {i + 1}</legend>
        <label className="block text-sm">Description<textarea value={item.description} onChange={(e) => update(i,'description',e.target.value)} maxLength={1500} placeholder="Describe exactly what this evidence shows, not what it proves." className="mt-1 min-h-20 w-full rounded-lg border border-gold/30 bg-ink p-3" /></label>
        <label className="block text-sm">Source URL (optional; not fetched or verified)<input type="url" value={item.sourceUrl ?? ''} onChange={(e) => update(i,'sourceUrl',e.target.value)} placeholder="https://…" className="mt-1 w-full rounded-lg border border-gold/30 bg-ink p-3" /></label>
        {evidence.length > 1 && <button type="button" onClick={() => {setEvidence((old) => old.filter((_,j)=>i!==j));setReview(null);}} className="text-sm text-parchment/70 underline">Remove item</button>}
      </fieldset>)}
      <button type="submit" disabled={busy || !claim.trim()} className="rounded-full bg-gold px-6 py-3 font-semibold text-ink disabled:opacity-50">{busy ? 'Examining evidence…' : 'Identify evidence gaps'}</button>
      {busy && <p role="status">Comparing the claim with supplied evidence. No source is being independently fetched.</p>}
      {error && <p role="alert" className="text-red-200">{error}</p>}
    </form>
    {review && <section aria-label="AI challenge findings" className="space-y-5 rounded-2xl border border-gold/30 p-5">
      <p className="text-xs uppercase tracking-[.2em] text-gold">AI analysis — unverified, non-authorizing</p>
      <div><h2 className="font-serif text-xl">Evidence gaps</h2><ul className="mt-2 list-disc space-y-2 pl-5">{review.evidenceGaps.map((g,i)=><li key={i}>{g}</li>)}</ul></div>
      <div><h2 className="font-serif text-xl">Attack questions</h2><ol className="mt-2 list-decimal space-y-2 pl-5">{review.attackQuestions.map((q,i)=><li key={i}>{q}</li>)}</ol></div>
      <div><h2 className="font-serif text-xl">Recommended next gate: {review.nextGate.replaceAll('_',' ')}</h2><p className="mt-1 text-sm">{review.gateReason}</p></div>
      <div><h2 className="font-serif text-xl">Limits</h2><ul className="mt-2 list-disc space-y-2 pl-5">{review.limitations.map((l,i)=><li key={i}>{l}</li>)}</ul></div>
      <p className="text-xs text-parchment/60">AI Gateway run receipt: {runId ?? 'Unavailable'}. This review does not establish governing law, source authenticity, facts, publication readiness or authority.</p>
    </section>}
  </section>;
}
