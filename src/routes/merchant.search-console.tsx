import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { pageHead } from "@/lib/seo";
import { authed } from "@/lib/merchant/authed-call";
import { getSearchConsoleSnapshot } from "@/lib/merchant/owner-intelligence.functions";

export const Route = createFileRoute("/merchant/search-console")({
  head: () => pageHead({
    path: "/merchant/search-console",
    title: "Search Console Monitoring | Truth Weaver",
    description: "Private monitoring for sitemap processing and Google index coverage.",
    noindex: true,
  }),
  component: SearchConsolePage,
});

type Snapshot = Awaited<ReturnType<typeof getSearchConsoleSnapshot>>;

function SearchConsolePage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await authed(getSearchConsoleSnapshot));
    } catch {
      setError("Search Console status could not be loaded. Check merchant access and try again.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  const siteSitemap = snapshot?.sitemaps.find((s) => s.path === snapshot.sitemap);
  return (
    <section className="max-w-5xl space-y-6" aria-labelledby="console-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="console-heading" className="font-serif text-3xl text-parchment">Search Console monitoring</h1>
          <p className="mt-2 text-sm text-parchment/70">
            Google's reported sitemap processing and indexed-page status. This is not a live crawl test.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading}
          className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink disabled:opacity-50">
          {loading ? "Checking…" : "Refresh Google status"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-danger/40 p-3 text-danger">{error}</p>}
      {loading && !snapshot && <p role="status" className="text-parchment/70">Checking Search Console…</p>}
      {snapshot && (
        <>
          <div className="rounded-xl border border-gold/20 bg-forest-deep/30 p-5">
            <p className="text-xs uppercase tracking-widest text-gold">Google connection</p>
            <p className="mt-2 font-semibold">{snapshot.connected ? "Connected · live API response" : "Not connected / unavailable"}</p>
            <p className="mt-1 break-all text-sm text-parchment/65">Property: {snapshot.property}</p>
            <p className="mt-1 text-xs text-parchment/55">Checked {snapshot.checkedAt}</p>
            {snapshot.error && <p role="alert" className="mt-3 text-sm text-parchment/80">{snapshot.error}</p>}
            {!snapshot.connected && <p className="mt-2 text-sm text-parchment/70">
              Configure server-only GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN and optionally GSC_SITE_URL
              using a Google account authorized for this exact Search Console property.
            </p>}
          </div>
          <div className="rounded-xl border border-gold/20 bg-forest-deep/30 p-5">
            <h2 className="font-serif text-xl">Sitemap processing</h2>
            <p className="mt-2 break-all text-sm text-parchment/75">{snapshot.sitemap}</p>
            <p className="mt-2 text-sm font-semibold text-gold">
              {!snapshot.connected ? "UNKNOWN" : !siteSitemap ? "Not listed among submitted sitemaps" : siteSitemap.isPending ? "Processing pending" : "Listed in Search Console"}
            </p>
            {siteSitemap && <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-parchment/50">Submitted</dt><dd>{siteSitemap.lastSubmitted ?? "Unknown"}</dd></div>
              <div><dt className="text-parchment/50">Downloaded</dt><dd>{siteSitemap.lastDownloaded ?? "Not reported"}</dd></div>
              <div><dt className="text-parchment/50">Errors</dt><dd>{siteSitemap.errors ?? "Not reported"}</dd></div>
              <div><dt className="text-parchment/50">Warnings</dt><dd>{siteSitemap.warnings ?? "Not reported"}</dd></div>
            </dl>}
          </div>
          <div className="rounded-xl border border-gold/20 bg-forest-deep/30 p-5">
            <h2 className="font-serif text-xl">Public page indexing</h2>
            <p className="mt-1 text-sm text-parchment/60">Only published, indexable canonical URLs are inspected; private and checkout pages are excluded.</p>
            <ul className="mt-5 space-y-3">
              {snapshot.pages.map((page) => (
                <li key={page.url} className="rounded-lg border border-gold/10 bg-ink/50 p-3">
                  <div className="flex flex-wrap justify-between gap-3">
                    <span className="break-all text-sm">{page.url}</span>
                    <strong className="text-xs tracking-wide text-gold">{page.status.replace("_", " ")}</strong>
                  </div>
                  <p className="mt-2 text-sm text-parchment/60">{page.coverage}</p>
                  {page.lastCrawl && <p className="mt-1 text-xs text-parchment/50">Last crawl: {page.lastCrawl}</p>}
                  {page.error && <p className="mt-1 text-xs text-parchment/65">{page.error}</p>}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-parchment/55">{snapshot.note} Indexing and AI search inclusion are never guaranteed.</p>
        </>
      )}
    </section>
  );
}
