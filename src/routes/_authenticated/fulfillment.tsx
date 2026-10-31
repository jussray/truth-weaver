import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, LoaderCircle, Printer, Trash2 } from "lucide-react";

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
        <h2 id="counsel-doc-h" className="font-serif text-2xl text-parchment">Truth Weaver Counsel document</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-parchment/65">
          A branded brief compiled from your latest Notice Analyzer result in this browser tab. Your notice text itself is never stored or included.
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
            This page does not yet link your account to Shopify orders, so it does not show any order as paid, delivered, refunded or returned.
          </StateBox></div>
        </section>
      </div>
      <p className="mt-5 text-sm text-parchment/70">
        Looking for a tool? <Link to="/shop" className="text-gold underline">Open the store</Link>.
      </p>
    </CounselPage>
  );
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
