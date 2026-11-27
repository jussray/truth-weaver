import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { authed } from "@/lib/merchant/authed-call";
import {
  getOwnerProofAccess,getOwnerSearchConsole,reviewOwnerClaim,
} from "@/lib/owner-proof/functions";
import type { ClaimReviewInput, SearchConsoleSnapshot } from "@/lib/owner-proof/contract";
import type { OwnerReviewResult } from "@/lib/owner-proof/gateway.server";

export const Route=createFileRoute("/_authenticated/owner-tools")({
  head:()=>({meta:[
    {title:"Site visibility & evidence gates — Truth Weaver Counsel"},
    {name:"description",content:"Private Search Console monitoring and evidence challenge tools."},
    {name:"robots",content:"noindex, nofollow"},
  ]}),
  component:OwnerProofPage,
});

type SearchResult={state:"not_configured";property:string}|{state:"connected";report:SearchConsoleSnapshot};
type EvidenceEntry={label:string;detail:string;url:string};
const blank=():EvidenceEntry=>({label:"",detail:"",url:""});
function show(value:number|string|null):string {return value===null?"Not reported":String(value);}

function OwnerProofPage() {
  const [access,setAccess]=useState<"checking"|"authorized"|"denied">("checking");
  const [search,setSearch]=useState<SearchResult|null>(null);
  const [searchLoading,setSearchLoading]=useState(false);
  const [searchError,setSearchError]=useState("");
  const [claim,setClaim]=useState("");
  const [items,setItems]=useState<EvidenceEntry[]>([blank()]);
  const [consent,setConsent]=useState(false);
  const [review,setReview]=useState<OwnerReviewResult|null>(null);
  const [reviewError,setReviewError]=useState("");
  const [reviewLoading,setReviewLoading]=useState(false);

  useEffect(()=>{
    let active=true;
    void authed(getOwnerProofAccess).then(r=>{
      if(active)setAccess(r.authorized?"authorized":"denied");
    }).catch(()=>{if(active)setAccess("denied");});
    return ()=>{active=false;};
  },[]);

  async function loadSearch() {
    setSearchLoading(true);setSearchError("");
    try {setSearch(await authed(getOwnerSearchConsole));}
    catch(e) {setSearch(null);setSearchError(e instanceof Error?e.message:"Search Console unavailable.");}
    finally {setSearchLoading(false);}
  }

  function editEntry(i:number,key:keyof EvidenceEntry,value:string) {
    setItems(current=>current.map((item,j)=>i===j?{...item,[key]:value}:item));
  }
  async function submitEvidence(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setReviewLoading(true);setReviewError("");setReview(null);
    try {
      if(!consent)throw new Error("Confirm consent before sending evidence to AI Gateway.");
      const evidence=items.map(item=>({
        label:item.label.trim(),detail:item.detail.trim(),
        ...(item.url.trim()?{url:item.url.trim()}:{})
      }));
      const input:ClaimReviewInput={claim:claim.trim(),evidence,consent:true};
      setReview(await authed(reviewOwnerClaim,input));
    } catch(e) {
      setReviewError(e instanceof Error?e.message:"Evidence review unavailable. No gate decision was made.");
    } finally {setReviewLoading(false);}
  }

  if(access==="checking")return <div role="status" className="grid min-h-screen place-items-center bg-ink text-parchment">Checking owner authorization…</div>;
  if(access!=="authorized")return (
    <div role="alert" className="grid min-h-screen place-items-center bg-ink px-4 text-parchment">
      <section className={`${tw.card} max-w-md text-center`}>
        <h1 className="font-serif text-2xl">Access restricted</h1>
        <p className="mt-3 text-sm text-parchment/70">A verified project-owner account is required.</p>
        <Link to="/account" className={`${tw.ghost} mt-4`}>Return to account</Link>
      </section>
    </div>
  );

  return <CounselPage title="Site visibility & evidence gates" eyebrow="Project owner · private">
    <WorkspaceNav />
    <p className="mb-6 text-sm text-parchment/75">
      Private monitoring and claim challenges. No customer details, access tokens, or secrets
      should be entered here. A model review cannot certify accuracy or authorize release.
    </p>
    <section className={tw.card} data-testid="owner-search-console">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Google Search Console</h2>
          <p className="mt-2 max-w-2xl text-sm text-parchment/70">
            Read-only sitemap processing and Google indexing verdicts for published canonical URLs.
            Inspection totals describe the sampled pages, not the site's complete indexing coverage.
          </p>
        </div>
        <button type="button" onClick={loadSearch} disabled={searchLoading} className={tw.btn}>
          {searchLoading?"Checking…":"Check indexing"}
        </button>
      </div>
      {searchError&&<div className="mt-4"><StateBox kind="error">{searchError}</StateBox></div>}
      {search?.state==="not_configured"&&<div className="mt-4">
        <StateBox kind="empty">Connection required. Grant the configured service account read access
          to the Search Console property, then bind its JSON credentials securely on the server.</StateBox>
      </div>}
      {search?.state==="connected"&&<div className="mt-5 space-y-5" aria-live="polite">
        <p className="text-xs text-parchment/60">Property: {search.report.property} · Fetched: {search.report.checkedAt} · Cached up to 15 minutes</p>
        <div className="rounded-lg border border-gold/20 p-4">
          <h3 className="font-semibold text-gold-soft">Sitemap processing</h3>
          <p className="mt-2 text-sm">State: {search.report.sitemap.processing.replaceAll("_"," ")}</p>
          <p className="mt-1 text-sm text-parchment/75">URLs submitted: {show(search.report.sitemap.submittedUrls)}
            {" · "}Errors: {show(search.report.sitemap.errors)} · Warnings: {show(search.report.sitemap.warnings)}</p>
          <p className="mt-1 text-xs text-parchment/60">Last submitted: {show(search.report.sitemap.submittedAt)}
            {" · "}Downloaded: {show(search.report.sitemap.downloadedAt)}</p>
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Page indexing · inspected URLs only</h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {search.report.pages.map(page=><li key={page.url} className="rounded-lg border border-gold/20 p-3 text-sm">
              <p className="break-all font-semibold text-parchment">{page.url}</p>
              <p className="mt-2">Verdict: {page.state.replaceAll("_"," ")}</p>
              <p className="mt-1 text-parchment/70">Coverage: {show(page.coverage)}</p>
              <p className="mt-1 text-xs text-parchment/60">Last crawl: {show(page.lastCrawl)}</p>
              {page.error&&<p role="status" className="mt-2 text-amber-200">Inspection unavailable · no indexing claim made</p>}
            </li>)}
          </ul>
          <p className="mt-2 text-xs text-parchment/60">Google does not expose the full Page Indexing report as an aggregate through this API.</p>
        </div>
      </div>}
    </section>
    <section className={`${tw.card} mt-6`} data-testid="owner-evidence-review">
      <h2 className="font-serif text-2xl">Claim evidence challenger</h2>
      <p className="mt-2 text-sm text-parchment/70">
        Enter a claim and supporting receipts. Cloudflare AI Gateway proposes missing proof, falsifiable
        attack questions and the next human verification gate. It neither validates sources nor takes actions.
      </p>
      <form className="mt-4 space-y-4" onSubmit={submitEvidence}>
        <label className="block text-sm">Claim
          <textarea className={`${tw.input} mt-1 min-h-24`} required minLength={12} maxLength={1800}
            value={claim} onChange={e=>setClaim(e.target.value)}
            placeholder="Example: The deployed site serves the approved exact commit." />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm">Evidence (one to six source receipts)</legend>
          <div className="space-y-3">
            {items.map((entry,i)=><div key={i} className="rounded-lg border border-gold/20 p-3">
              <label className="block text-xs">Evidence label
                <input className={`${tw.input} mt-1`} required minLength={3} maxLength={120}
                  value={entry.label} onChange={e=>editEntry(i,"label",e.target.value)} />
              </label>
              <label className="mt-2 block text-xs">Observed evidence and timestamp
                <textarea className={`${tw.input} mt-1 min-h-20`} required minLength={10} maxLength={1400}
                  value={entry.detail} onChange={e=>editEntry(i,"detail",e.target.value)} />
              </label>
              <label className="mt-2 block text-xs">Source URL (optional; never automatically opened)
                <input className={`${tw.input} mt-1`} type="url" maxLength={400}
                  value={entry.url} onChange={e=>editEntry(i,"url",e.target.value)} />
              </label>
              {items.length>1&&<button type="button" className={`${tw.ghost} mt-2`}
                onClick={()=>setItems(current=>current.filter((_,j)=>i!==j))}>Remove evidence</button>}
            </div>)}
          </div>
          {items.length<6&&<button type="button" className={`${tw.ghost} mt-3`}
            onClick={()=>setItems(current=>[...current,blank()])}>Add evidence</button>}
        </fieldset>
        <label className="flex items-start gap-2 text-sm text-parchment/75">
          <input type="checkbox" className="mt-1" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>
          I consent to sending these entries to the configured AI model. I confirm they contain no secrets or private customer data.
        </label>
        <button type="submit" className={tw.btn} disabled={reviewLoading}>{reviewLoading?"Reviewing…":"Challenge evidence"}</button>
      </form>
      {reviewError&&<div className="mt-4"><StateBox kind="error">{reviewError}</StateBox></div>}
      {review&&<div className="mt-5 space-y-4" aria-live="polite">
        <p className={tw.label}>Advisory only · {review.reviewedAt}</p>
        <div><h3 className="font-semibold">Evidence gaps</h3><ul className="ml-5 list-disc text-sm text-parchment/80">
          {review.gaps.map((g,i)=><li key={i}><strong>{g.issue}</strong> — {g.neededProof}</li>)}
        </ul></div>
        <div><h3 className="font-semibold">Challenge questions</h3><ul className="ml-5 list-disc text-sm text-parchment/80">
          {review.attackQuestions.map((q,i)=><li key={i}>{q}</li>)}
        </ul></div>
        <div className="rounded-lg border border-gold/30 p-4">
          <h3 className="font-semibold">Recommended next gate: {review.nextGate.replaceAll("-"," ")}</h3>
          <p className="mt-1 text-sm text-parchment/80">{review.gateReason}</p>
          <p className="mt-2 text-xs text-parchment/60">Requires independent human verification; no deployment or entitlement is authorized.</p>
        </div>
      </div>}
    </section>
  </CounselPage>;
}
