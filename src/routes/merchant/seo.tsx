import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { pageHead } from '@/lib/seo';
import { authed } from '@/lib/merchant/authed-call';
import { getOwnerSearchConsole } from '@/lib/owner-review.functions';
import type { SitemapStatus, InspectionStatus } from '@/lib/owner-review';

type Data = { property: string; checkedAt: string; sitemaps: SitemapStatus[]; inspections: InspectionStatus[]; sitemapError: string | null; inspectionErrors: number };
export const Route = createFileRoute('/merchant/seo')({
  head: () => pageHead({ path: '/merchant/seo', title: 'Search Console | Owner | Truth Weaver', description: 'Private verified Google indexing evidence.', noindex: true }),
  component: OwnerSeoPage,
});
function date(value: string | null) { return value ? new Date(value).toLocaleString() : 'Not reported'; }
function OwnerSeoPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  async function load() {
    setBusy(true); setError('');
    try { setData(await authed(getOwnerSearchConsole)); }
    catch (e) { setData(null); setError(e instanceof Error ? e.message : 'Google indexing evidence unavailable.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  return (
    <section className="mx-auto max-w-6xl space-y-6" aria-labelledby="sc-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs uppercase tracking-[.2em] text-gold">Owner intelligence · private</p>
          <h1 id="sc-title" className="mt-1 font-serif text-3xl">Search Console monitoring</h1>
          <p className="mt-2 max-w-3xl text-sm text-parchment/70">Google's latest reported sitemap processing and URL-index inspection. This is not a live crawl, and submission is not indexing.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink disabled:opacity-50">{busy ? 'Checking…' : 'Refresh Google status'}</button>
      </div>
      {busy && <p role="status" className="rounded-xl border border-gold/20 p-5 text-parchment/80">Retrieving authorized Search Console reports…</p>}
      {error && <div role="alert" className="rounded-xl border border-red-400/40 p-5 text-red-200">{error} Search Console requires a verified property and secure, read-only OAuth access.</div>}
      {data && <>
        <p className="text-xs text-parchment/60">Property: {data.property} · Checked: {date(data.checkedAt)} · {data.inspectionErrors} URL inspections unavailable.</p>
        <section aria-label="Sitemap processing" className="space-y-3">
          <h2 className="font-serif text-2xl">Sitemap processing</h2>
          {data.sitemapError && <p role="alert" className="text-red-200">{data.sitemapError}</p>}
          {!data.sitemapError && !data.sitemaps.length && <p>No submitted sitemaps reported by Google. This does not mean the sitemap is invalid.</p>}
          {data.sitemaps.map((s) => <article key={s.url} className="rounded-xl border border-gold/20 bg-forest-deep/40 p-5">
            <h3 className="break-all font-semibold">{s.url}</h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-parchment/60">Processing</dt><dd>{s.pending ? 'Pending' : 'Not pending'}</dd></div>
              <div><dt className="text-parchment/60">Submitted</dt><dd>{date(s.submitted)}</dd></div>
              <div><dt className="text-parchment/60">Last downloaded</dt><dd>{date(s.downloaded)}</dd></div>
              <div><dt className="text-parchment/60">URLs submitted</dt><dd>{s.submittedUrls ?? 'Not reported'}</dd></div>
              <div><dt className="text-parchment/60">Errors</dt><dd>{s.errors}</dd></div>
              <div><dt className="text-parchment/60">Warnings</dt><dd>{s.warnings}</dd></div>
            </dl>
          </article>)}
        </section>
        <section aria-label="URL indexing" className="space-y-3">
          <h2 className="font-serif text-2xl">Page indexing</h2>
          {data.inspections.map((p) => <article key={p.url} className="rounded-xl border border-gold/20 bg-forest-deep/40 p-5">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="break-all font-semibold">{p.url}</h3><span className="text-sm text-gold">{p.indexed === true ? 'Google reports indexed' : p.indexed === false ? 'Not indexed in inspection' : 'Unknown'}</span></div>
            <p className="mt-2 text-sm text-parchment/75">{p.coverage} · Indexing: {p.indexing} · Fetch: {p.fetch}</p>
            <p className="mt-1 text-xs text-parchment/60">Google last crawl: {date(p.lastCrawl)} · Canonical: {p.googleCanonical ?? 'Not reported'}</p>
            {p.error && <p role="alert" className="mt-2 text-sm text-red-200">{p.error}</p>}
          </article>)}
        </section>
      </>}
      <p className="text-xs text-parchment/60">Source: Google Search Console API. Sitemap indexed counts are deprecated; inspected URLs are the approved public sitemap pages only. No automated indexing requests are made.</p>
    </section>
  );
}
