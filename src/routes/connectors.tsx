import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { SiteChrome, StatusPill } from "@/components/storefront/site-chrome";
import { CONNECTORS, CONNECTOR_STATUS_LABEL, type ConnectorPath } from "@/lib/connectors/registry";
import { useConnectorStatuses } from "@/lib/connectors/use-connector-status";

export const Route = createFileRoute("/connectors")({
  head: () => ({
    meta: [
      { title: "Source Center | Truth Weaver Counsel" },
      { name: "description", content: "Where Truth Weaver's knowledge comes from: official sources, AI helpers and the store — each with a truthful connection status." },
      { property: "og:title", content: "Source Center | Truth Weaver Counsel" },
      { property: "og:description", content: "Official sources, AI helpers and the store — each with a truthful connection status and provenance." },
    ],
  }),
  component: SourceCenter,
});

const PATH_LABEL: Record<ConnectorPath, string> = {
  lovable_ai: "Built-in AI",
  standard_connector: "Connector",
  shopify_integration: "Store integration",
  custom_adapter: "Custom adapter",
  public_web: "Public sources",
};

function SourceCenter() {
  const { statuses, error } = useConnectorStatuses();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CONNECTORS.filter((c) => !needle || `${c.name} ${c.role}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.consumerFacing) - Number(a.consumerFacing));
  }, [q]);

  return (
    <SiteChrome>
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-gold">Source Center</p>
        <h1 className="mt-3 font-serif text-5xl text-parchment sm:text-6xl">Where our knowledge comes from.</h1>
        <p className="mt-4 max-w-3xl leading-7 text-parchment/70">
          Every result carries its provider, source link or ID, when it was retrieved, the jurisdiction it concerns,
          the kind of evidence it is, and how far it has been verified. AI and web results can point you to evidence —
          they never become verified law on their own.
        </p>
        {error ? <p className="mt-4 text-sm text-warn">Couldn’t check connection status; showing everything as not linked.</p> : null}

        <label id="search" className="mt-8 block max-w-md">
          <span className="sr-only">Search sources</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sources and helpers…"
            className="w-full rounded-full border border-gold/30 bg-forest-deep/50 px-5 py-3 text-sm text-parchment outline-none placeholder:text-parchment/40 focus:border-gold"
          />
        </label>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <article key={c.id} data-connector={c.id} className="rounded-2xl border border-parchment/10 bg-forest-deep/40 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl text-parchment">{c.name}</h2>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-parchment/50">{PATH_LABEL[c.path]}{c.consumerFacing ? "" : " · optional"}</p>
                </div>
                <StatusPill status={statuses[c.id]} label={CONNECTOR_STATUS_LABEL[statuses[c.id]]} />
              </div>
              <p className="mt-3 text-sm leading-6 text-parchment/75">{c.role}</p>
              <p className="mt-3 border-t border-parchment/10 pt-3 text-xs leading-5 text-parchment/55">{c.limits}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {[
            ["Connected", "Linked and callable from our server."],
            ["Available", "Ready to use without your own key."],
            ["Needs setup", "A connection must be linked first."],
            ["Not configured", "No endpoint or credentials supplied."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-gold/15 p-4">
              <p className="font-semibold text-gold-soft">{t}</p>
              <p className="mt-1 text-xs text-parchment/60">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteChrome>
  );
}
