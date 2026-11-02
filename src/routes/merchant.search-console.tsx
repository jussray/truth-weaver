import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { authed } from "@/lib/merchant/authed-call";
import { getSearchConsoleReport } from "@/lib/search-console.functions";
import type { SearchConsoleSnapshot } from "@/lib/search-console";

export const Route = createFileRoute("/merchant/search-console")({
  head: () => ({ meta: [{ title: "Search Console | Truth Weaver" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SearchConsolePage,
});

function SearchConsolePage() {
  const [result, setResult] = useState<SearchConsoleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    authed(getSearchConsoleReport).then(setResult).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : "Search Console could not be read.")
    ).finally(() => setLoading(false));
  }, []);
  useEffect(refresh, [refresh]);

  return (
    <section aria-labelledby="search-console-h" className="max-w-5xl space-y-6" data-testid="search-console-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold">Private owner monitoring</p>
          <h1 id="search-console-h" className="mt-2 font-serif text-3xl">Search Console</h1>
          <p className="mt-2 max-w-2xl text-sm text-parchment/70">Google-reported sitemap processing and URL inspection for the published Truth Weaver site. This is not a live indexing test or a search-ranking guarantee.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="rounded-full border border-gold/50 px-5 py-2 text-sm text-gold disabled:opacity-50">{loading ? "Checking…" : "Refresh report"}</button>
      </div>
      {loading && <p role="status" className="text-sm text-parchment/70">Checking Google Search Console…</p>}
      {error && <div role="alert" className="rounded-xl border border-danger/40 p-4 text-sm text-danger">{error}</div>}
      {result?.state === "not-configured" && (
        <div role="status" data-testid="search-console-unconfigured" className="rounded-xl border border-warn/40 bg-forest-deep/30 p-5">
          <h2 className="font-semibold text-gold">Connection required</h2>
          <p className="mt-2 text-sm text-parchment/70">Search Console has not been connected on the server. A service account must be granted read access to the property and configured as a protected server secret. No indexing data is being estimated.</p>
          <p className="mt-2 break-all text-xs text-parchment/60">Property: {result.property}</p>
        </div>
      )}
      {result?.state === "connected" && (
        <>
          <p className="text-xs text-parchment/60" data-testid="search-console-checked-at">Google data checked at {new Date(result.checkedAt).toLocaleString()} · Property: {result.property} · Cached for up to 15 minutes.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-xl border border-gold/20 bg-forest-deep/30 p-5" data-testid="sitemap-processing">
              <h2 className="font-serif text-xl">Sitemap processing</h2>
              <p className="mt-2 text-lg font-semibold text-gold">{result.sitemap.state === "not-submitted" ? "Not reported as submitted" : result.sitemap.state === "pending" ? "Pending processing" : "Processed"}</p>
              <dl className="mt-3 space-y-2 text-sm text-parchment/70">
                <div>Submitted: {result.sitemap.submittedAt ?? "Not reported"}</div>
                <div>Last downloaded: {result.sitemap.downloadedAt ?? "Not reported"}</div>
                <div>URLs in sitemap: {result.sitemap.submittedUrls ?? "Not reported"}</div>
                <div>Processing errors: {result.sitemap.errors} · Warnings: {result.sitemap.warnings}</div>
              </dl>
            </article>
            <article className="rounded-xl border border-gold/20 bg-forest-deep/30 p-5" data-testid="indexing-summary">
              <h2 className="font-serif text-xl">Page indexing</h2>
              <p className="mt-3 text-2xl font-semibold text-gold">{result.indexedCount} / {result.inspectedCount}</p>
              <p className="mt-2 text-sm text-parchment/70">Monitored public URLs reported as indexed by Google. This is not a count of every page on the domain.</p>
              <p className="mt-2 text-xs text-parchment/60">The Search Console sitemap “indexed” count is deprecated and is not used here.</p>
            </article>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gold/20">
            <table className="w-full min-w-[650px] text-left text-sm" data-testid="indexing-pages">
              <thead className="bg-forest-deep/50 text-parchment/80"><tr><th className="p-3">Page</th><th className="p-3">Google status</th><th className="p-3">Coverage</th><th className="p-3">Last crawl</th></tr></thead>
              <tbody className="divide-y divide-gold/10">
                {result.pages.map((page) => (
                  <tr key={page.url}>
                    <td className="break-all p-3"><a href={page.url} target="_blank" rel="noreferrer" className="text-gold underline">{page.url}</a></td>
                    <td className="p-3">{page.state === "indexed" ? "Indexed" : page.state === "not-indexed" ? "Not indexed" : "Unknown"}</td>
                    <td className="p-3">{page.coverage ?? "Not reported"}{page.robots === "DISALLOWED" ? " · Robots blocked" : ""}</td>
                    <td className="p-3">{page.lastCrawl ?? "Not crawled / unavailable"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
