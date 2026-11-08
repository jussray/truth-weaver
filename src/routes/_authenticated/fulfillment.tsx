import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, LoaderCircle, Printer, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { downloadMySnapshotReport, getMySnapshotReports } from "@/lib/commerce/snapshot-report.functions";

import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import {
  COUNSEL_STORAGE_KEY,
  buildCounselDocument,
  parseStoredAnalysis,
  type CounselDocument,
  type StoredCounselAnalysis,
} from "@/lib/counsel-document";

// Read back from the connected Truth Weaver Shopify Admin account on 2026-10-13.
// Shopify's Customer Accounts owns actual order identities and order data.
const SHOPIFY_CUSTOMER_ACCOUNT_URL = "https://shopify.com/85973860573/account";

export const Route = createFileRoute("/_authenticated/fulfillment")({
  head: () => ({
    meta: [
      { title: "Counsel documents & orders — Truth Weaver Counsel" },
      { name: "description", content: "Download your Truth Weaver Counsel notice brief and open your verified Shopify orders." },
      { property: "og:title", content: "Counsel documents & orders — Truth Weaver Counsel" },
      { property: "og:description", content: "Your notice brief and links to store orders. Downloading a brief is not payment verification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FulfillmentPage,
});

type LoadState = { status: "loading" } | { status: "empty" } | { status: "invalid" } | { status: "ready"; stored: StoredCounselAnalysis };

function FulfillmentPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(COUNSEL_STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return setState({ status: "empty" });
    const stored = parseStoredAnalysis(raw);
    setState(stored ? { status: "ready", stored } : { status: "invalid" });
  }, []);

  function clear() {
    try {
      sessionStorage.removeItem(COUNSEL_STORAGE_KEY);
    } catch {
      // ignore
    }
    setState({ status: "empty" });
  }

  return (
    <CounselPage title="Counsel documents & orders" eyebrow="Your deliverables" back={{ to: "/dashboard", label: "Dashboard" }}>
      <WorkspaceNav />

      <section aria-labelledby="counsel-doc-h" className="mb-6">
        <h2 id="counsel-doc-h" className="font-serif text-2xl text-parchment">Free browser Counsel PDF</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-parchment/65">
          A free brief compiled from your latest Notice Analyzer result in this browser tab. This is not a purchased Notice Snapshot report. Your notice text itself is never stored or included.
        </p>
        <div className="mt-4">
          {state.status === "loading" && <StateBox kind="loading">Loading your latest analysis…</StateBox>}
          {state.status === "empty" && (
            <div data-testid="counsel-empty" className={tw.card}>
              <p className="text-sm leading-6 text-parchment/75">
                No analysis is ready in this tab yet. Run a notice through the analyzer, then choose <strong>Open Counsel document</strong>.
              </p>
              <Link to="/notice-analyzer" className={`${tw.btn} mt-4`}>Analyze a notice</Link>
            </div>
          )}
          {state.status === "invalid" && (
            <StateBox kind="error">
              The saved analysis could not be read safely, so no document was produced. Run the notice through the analyzer again.
              <div className="mt-3"><button type="button" onClick={clear} className={tw.ghost}>Clear saved analysis</button></div>
            </StateBox>
          )}
          {state.status === "ready" && <CounselDocumentView stored={state.stored} onClear={clear} />}
        </div>
      </section>

      <PaidSnapshotReports />

      <div className="grid gap-4 md:grid-cols-2">
        <section className={tw.card}>
          <p className={tw.label}>Your actual orders</p>
          <h2 className="mt-2 font-serif text-2xl">Check status with Shopify</h2>
          <p className="mt-3 text-sm leading-6 text-parchment/70">
            Sign into the store's Shopify customer account to see purchases, payment and fulfillment status, and return options when eligible.
          </p>
          <a href={SHOPIFY_CUSTOMER_ACCOUNT_URL} rel="noreferrer noopener" target="_blank" className={`${tw.btn} mt-5`}>
            View my Shopify orders
          </a>
          <p className="mt-3 text-xs text-parchment/50">Opens the official Shopify account for this store. You may be asked to sign in separately.</p>
        </section>
        <section className={tw.card}>
          <p className={tw.label}>Delivery, tracking & returns</p>
          <h2 className="mt-2 font-serif text-2xl">Status comes from Shopify</h2>
          <p className="mt-3 text-sm leading-6 text-parchment/70">
            Downloadable products have no shipping tracking. Shopify shows return or refund actions only when offered for that order.
          </p>
          <div className="mt-4"><StateBox kind="empty">
            A recorded purchase does not prove a report is ready. Each paid-report download requires a new payment and account check. Shopify holds the full order status.
          </StateBox></div>
        </section>
      </div>
      {/* The authenticated PaidSnapshotReports flow above is the active, owner-verified PDF delivery. 
          The older signed-link SnapshotDownloadPanel must not be mounted here. */}
      <p className="mt-5 text-sm text-parchment/70">
        Looking for a tool? <Link to="/shop" className="text-gold underline">Open the store</Link>.
      </p>
    </CounselPage>
  );
}

function PaidSnapshotReports() {
  const listReports = useServerFn(getMySnapshotReports);
  const downloadReport = useServerFn(downloadMySnapshotReport);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getMySnapshotReports>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const next = token ? await listReports({ headers: { Authorization: `Bearer ${token}` } })
          : { state: "not_authenticated" as const, orders: [] };
        if (active) setResult(next);
      } catch {
        if (active) setResult({ state: "unavailable", orders: [] });
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [listReports]);

  async function download() {
    setBusy("checking");
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setError("Please sign in again to check your report."); return; }
      const response = await downloadReport({ headers: { Authorization: `Bearer ${token}` } });
      if (response.state !== "ready") {
        setError(response.state === "not_authenticated" ? "Please sign in again to check your report."
          : "Your report is not available. Payment, account ownership and a stored report must all be verified before download.");
        return;
      }
      // Report bytes stay in memory, never browser storage or provider URLs.
      const binary = atob(response.base64);
      if (binary.length > 524288 || response.mediaType !== "application/pdf" || !binary.startsWith("%PDF-")) {
        setError("The report could not be read safely. No file was downloaded."); return;
      }
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: response.mediaType }));
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noreferrer noopener";
      link.referrerPolicy = "no-referrer";
      link.download = "Truth-Weaver-Notice-Snapshot.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("We could not check your report. No download was authorized. Please try again later."); }
    finally { setBusy(null); }
  }

  return <section aria-labelledby="paid-report-h" className="mb-6">
    <h2 id="paid-report-h" className="font-serif text-2xl text-parchment">Purchased Notice Snapshot reports</h2>
    <p className="mt-1 max-w-3xl text-sm leading-6 text-parchment/65">Separate from your free browser PDF. We check your newest eligible Snapshot purchase, payment and stored report before downloading. A purchase alone does not mean a report is ready.</p>
    <Button className={`${tw.btn} mt-4`} onClick={() => void download()} disabled={busy !== null || loading}>
      {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      {busy ? "Checking report…" : "Check and download my paid Snapshot"}
    </Button>
    <div className="mt-4" aria-live="polite" aria-busy={loading || busy !== null}>
      {loading && <StateBox kind="loading">Checking your account…</StateBox>}
      {!loading && result?.state === "not_authenticated" && <StateBox kind="error">Please sign in again to view your reports.</StateBox>}
      {!loading && result?.state === "not_linked" && <StateBox kind="empty">Your Shopify account has not been verified with this account. No paid report is available here yet. You can still check your orders with Shopify below.</StateBox>}
      {!loading && result?.state === "unavailable" && <StateBox kind="error">We could not check your purchases. No payment or report availability has been confirmed.</StateBox>}
      {!loading && result?.state === "ok" && result.orders.length === 0 && <StateBox kind="empty">No eligible Snapshot purchase is recorded for your account. No paid report is available here.</StateBox>}
      {!loading && result?.state === "ok" && result.orders.length > 0 && <ul className="space-y-3">
        {result.orders.map(order => <li key={order.orderId} className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/20 py-3">
          <div><h3 className="text-parchment">Notice Snapshot · Order {order.orderId.split("/").at(-1)}</h3><p className="text-sm text-parchment/65">Recorded access. Payment and report readiness will be checked.</p></div>
        </li>)}
      </ul>}
      {error && <StateBox kind="error">{error}</StateBox>}
    </div>
  </section>;
}

function CounselDocumentView({ stored, onClear }: { stored: StoredCounselAnalysis; onClear: () => void }) {
  const doc: CounselDocument = useMemo(() => buildCounselDocument(stored), [stored]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const { downloadCounselPdf } = await import("@/lib/counsel-pdf");
      await downloadCounselPdf(doc);
    } catch (cause) {
      console.error("Counsel PDF failed", cause);
      setError("The PDF could not be created in this browser. Use Print and choose “Save as PDF” instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 print:hidden">
        <button type="button" data-testid="download-counsel-pdf" onClick={download} disabled={busy} className={tw.btn}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          {busy ? "Preparing PDF…" : "Download PDF"}
        </button>
        <button type="button" onClick={() => window.print()} className={tw.ghost}>
          <Printer className="h-4 w-4" aria-hidden /> Print
        </button>
        <button type="button" onClick={onClear} className={tw.ghost}>
          <Trash2 className="h-4 w-4" aria-hidden /> Remove from this device
        </button>
      </div>
      {error && <div className="mb-4"><StateBox kind="error">{error}</StateBox></div>}

      <article data-testid="counsel-document" aria-label="Truth Weaver Counsel document" className="overflow-hidden rounded-2xl border border-gold/30 bg-parchment text-ink shadow-xl print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b-4 border-gold bg-forest-deep px-5 py-6 sm:px-8">
          <div className="flex items-center gap-2 text-gold"><FileText className="h-5 w-5" aria-hidden /><span className="text-[11px] font-bold uppercase tracking-[0.25em]">Notice brief</span></div>
          <h3 className="mt-2 font-serif text-3xl text-gold sm:text-4xl">{doc.title}</h3>
          <p className="mt-1 break-words font-serif text-lg italic text-parchment">{doc.subtitle}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {doc.banner.map((b) => (
              <li key={b} className="rounded-full border border-gold/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-gold">{b}</li>
            ))}
          </ul>
        </header>

        <div className="px-5 py-6 sm:px-8">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {doc.meta.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-deep">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>

          {doc.sections.map((section) => (
            <section key={section.id} data-section={section.id} className="mt-7 border-t border-gold pt-4">
              <h4 className="font-serif text-xl font-semibold text-forest-deep">{section.heading}</h4>
              {section.items.length === 0 ? (
                <p className="mt-2 text-sm italic">{section.empty}</p>
              ) : (
                <ol className="mt-3 space-y-4">
                  {section.items.map((item, i) => (
                    <li key={`${section.id}-${i}`} className="break-words">
                      <p className="font-semibold">{item.title}</p>
                      {item.lines.map((line, j) => <p key={j} className="mt-1 pl-3 text-sm leading-6">{line}</p>)}
                      {item.flag && <p className="mt-1 pl-3 text-xs font-bold uppercase tracking-wide text-warn">{item.flag}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}

          <section className="mt-7 border-t border-gold pt-4">
            <h4 className="font-serif text-xl font-semibold text-forest-deep">Source and authority limits</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
              {doc.limits.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </section>
          <p className="mt-6 text-[11px] uppercase tracking-[0.14em] text-forest-deep">{doc.reference} · Non-authorizing · Governing law is the authority</p>
        </div>
      </article>
    </div>
  );
}
