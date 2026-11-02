import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";
import { readOwnerSearchConsole, reviewOwnerEvidence } from "@/lib/owner-tools.functions";
import type { SearchConsoleReport, EvidenceAssessment } from "@/lib/owner-tools.shared";

export const Route = createFileRoute("/_authenticated/owner-tools")({
  head: () => ({
    meta: [
      { title:"Owner verification tools — Truth Weaver Counsel" },
      { name:"robots",content:"noindex, nofollow" },
      { name:"description",content:"Private sitemap processing and evidence review tools for authorized project owners." },
    ],
  }),
  component: OwnerToolsPage,
});

async function accessToken(): Promise<string> {
  const {data,error} = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in again to use owner tools.");
  return data.session.access_token;
}
const stateLabel = (value: string | null) => value ?? "Not reported";
const countLabel = (value: number | null) => value === null ? "Not reported" : value.toLocaleString();

function OwnerToolsPage() {
  const [report,setReport] = useState<SearchConsoleReport | null>(null);
  const [reportError,setReportError] = useState("");
  const [reportLoading,setReportLoading] = useState(false);
  const [claim,setClaim] = useState("");
  const [evidence,setEvidence] = useState("");
  const [analysis,setAnalysis] = useState<EvidenceAssessment | null>(null);
  const [analysisError,setAnalysisError] = useState("");
  const [analysisLoading,setAnalysisLoading] = useState(false);
  const evidenceLines = evidence.split("\n").map(line=>line.trim()).filter(Boolean);

  async function loadSearchStatus() {
    setReportLoading(true); setReportError("");
    try {
      const response = await readOwnerSearchConsole({data:{authAccessToken:await accessToken()}});
      setReport(response);
    } catch (err) {
      setReport(null);
      setReportError(err instanceof Error ? err.message : "Search Console data unavailable.");
    } finally { setReportLoading(false); }
  }

  async function analyzeClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAnalysis(null); setAnalysisError("");
    if (claim.trim().length < 12 || claim.length > 2000 ||
        evidenceLines.length < 1 || evidenceLines.length > 8 ||
        evidenceLines.some(line => line.length < 10 || line.length > 1200)) {
      setAnalysisError("Enter a claim (12–2,000 characters) and 1–8 evidence lines (10–1,200 characters each).");
      return;
    }
    setAnalysisLoading(true);
    try {
      const response = await reviewOwnerEvidence({
        data:{authAccessToken:await accessToken(),input:{claim:claim.trim(),evidence:evidenceLines}},
      });
      setAnalysis(response);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Evidence review unavailable.");
    } finally { setAnalysisLoading(false); }
  }

  return (
    <CounselPage eyebrow="Private · owner-verified" title="Site visibility & evidence gates">
      <WorkspaceNav />
      <p className="mb-6 text-sm text-parchment/70">
        These tools require an allowlisted project-owner account. Private verification data and
        claims are never added to public pages. Do not submit secrets or identifiable customer records.
      </p>
      <section className={tw.card} aria-labelledby="search-console-heading">
        <h2 id="search-console-heading" className="font-serif text-2xl">Google Search Console</h2>
        <p className="mt-2 text-sm text-parchment/70">
          Read-only sitemap processing and the most recent Google URL Inspection result for each
          published canonical page. These six sampled URLs are not a site-wide indexing count.
        </p>
        <button type="button" className={`${tw.btn} mt-4`} onClick={loadSearchStatus} disabled={reportLoading}>
          {reportLoading ? "Checking…" : report ? "Refresh status" : "Check indexing"}
        </button>
        {reportError && <div className="mt-4"><StateBox kind="error">{reportError}</StateBox></div>}
        {report && (
          <div className="mt-5 space-y-5" aria-live="polite">
            <p className="text-xs text-parchment/60">Property: {report.property} · Fetched: {report.checkedAt} · Cached up to 10 minutes.</p>
            <div>
              <h3 className="mb-2 font-semibold">Sitemap processing</h3>
              {report.sitemaps.length ? (
                <ul className="space-y-2">{report.sitemaps.map(s => (
                  <li className="rounded-lg border border-gold/20 p-3 text-sm" key={s.path}>
                    <p className="break-all font-medium">{s.path}</p>
                    <p className="mt-1 text-parchment/70">
                      Processing: {s.isPending === null ? "Not reported" : s.isPending ? "Pending" : "Not pending"}
                      {" · "}Errors: {countLabel(s.errors)} · Warnings: {countLabel(s.warnings)}
                    </p>
                    <p className="mt-1 text-parchment/70">Submitted: {countLabel(s.submitted)} · Indexed (sitemap-reported): {countLabel(s.indexed)}</p>
                    <p className="mt-1 text-xs text-parchment/60">Last submitted: {stateLabel(s.lastSubmitted)}</p>
                  </li>
                ))}</ul>
              ) : <StateBox kind="empty">No submitted sitemaps were returned for this property.</StateBox>}
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Page indexing · inspected URLs only</h3>
              <ul className="space-y-2">{report.pages.map(p => (
                <li key={p.url} className="rounded-lg border border-gold/20 p-3 text-sm">
                  <p className="break-all font-medium">{p.url}</p>
                  <p className="mt-1">Google coverage: {p.coverageState}</p>
                  <p className="mt-1 text-parchment/70">
                    Verdict: {p.verdict} · Last crawl: {stateLabel(p.lastCrawlTime)}
                    {" · "}Robots: {stateLabel(p.robotsTxtState)}
                  </p>
                  {p.error && <p role="status" className="text-amber-200">Inspection unavailable; no indexing claim made.</p>}
                </li>
              ))}</ul>
            </div>
          </div>
        )}
      </section>
      <section className={`${tw.card} mt-6`} aria-labelledby="evidence-heading">
        <h2 id="evidence-heading" className="font-serif text-2xl">Claim evidence challenger</h2>
        <p className="mt-2 text-sm text-parchment/70">
          Enter a specific claim and its supporting evidence. Cloudflare AI Gateway will propose
          missing proof, adversarial questions, and the next verification gate. Model findings are
          hypotheses—not independent verification or approval to publish.
        </p>
        <form className="mt-4 space-y-4" onSubmit={analyzeClaim}>
          <label className="block text-sm">Claim
            <textarea className={`${tw.input} mt-1 min-h-24`} value={claim}
              onChange={e=>setClaim(e.target.value)} maxLength={2000} required
              placeholder="Example: The production checkout returns a verified order receipt." />
          </label>
          <label className="block text-sm">Supporting evidence · one item per line
            <textarea className={`${tw.input} mt-1 min-h-36`} value={evidence}
              onChange={e=>setEvidence(e.target.value)} required
              placeholder="Source name, timestamp, exact observed outcome, and receipt reference (no secrets)." />
          </label>
          <button className={tw.btn} disabled={analysisLoading} type="submit">
            {analysisLoading ? "Evaluating…" : "Challenge evidence"}
          </button>
        </form>
        {analysisError && <div className="mt-4"><StateBox kind="error">{analysisError}</StateBox></div>}
        {analysis && <div className="mt-5 space-y-4" aria-live="polite">
          <div><h3 className="font-semibold">Evidence gaps</h3>
            <ul className="ml-5 list-disc text-sm text-parchment/80">{analysis.gaps.map((v,i)=><li key={i}>{v}</li>)}</ul></div>
          <div><h3 className="font-semibold">Attack questions</h3>
            <ul className="ml-5 list-disc text-sm text-parchment/80">{analysis.attackQuestions.map((v,i)=><li key={i}>{v}</li>)}</ul></div>
          <div className="rounded-lg border border-gold/30 p-4">
            <h3 className="font-semibold">Recommended next gate: {analysis.nextGate.name}</h3>
            <p className="mt-1 text-sm">{analysis.nextGate.passCriteria}</p>
            <p className="mt-2 text-xs text-parchment/60">Evidence needed:</p>
            <ul className="ml-5 list-disc text-sm text-parchment/80">
              {analysis.nextGate.requiredEvidence.map((v,i)=><li key={i}>{v}</li>)}
            </ul>
          </div>
        </div>}
      </section>
    </CounselPage>
  );
}
