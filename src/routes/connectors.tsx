import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { SiteChrome, StatusPill } from "@/components/storefront/site-chrome";
import {
  getLinearWitnessReadiness,
  runLinearCustodyWitness,
} from "@/lib/connectors/linear-witness.functions";
import { CONNECTORS, CONNECTOR_STATUS_LABEL, type ConnectorPath } from "@/lib/connectors/registry";
import { useConnectorStatuses } from "@/lib/connectors/use-connector-status";

export const Route = createFileRoute("/connectors")({
  loader: () => getLinearWitnessReadiness(),
  head: () => ({
    meta: [
      { title: "Source Center | Truth Weaver Counsel" },
      {
        name: "description",
        content:
          "Where Truth Weaver's knowledge comes from: official sources, AI helpers and the store — each with a truthful connection status.",
      },
      { property: "og:title", content: "Source Center | Truth Weaver Counsel" },
      {
        property: "og:description",
        content: "Official sources, AI helpers and the store — each with a truthful connection status and provenance.",
      },
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

type WitnessReadiness = Awaited<ReturnType<typeof getLinearWitnessReadiness>>;

function WitnessConsole({ readiness }: { readiness: WitnessReadiness }) {
  const [token, setToken] = useState("");
  const [witnessRunId, setWitnessRunId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setWitnessRunId(crypto.randomUUID());
  }, []);

  async function runWitness() {
    if (!readiness.ready || !token || !witnessRunId || pending) return;
    setPending(true);
    setResult(null);
    try {
      const response = await runLinearCustodyWitness({ data: { token, witnessRunId } });
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            status: "BLOCKED",
            promotion: "BLOCKED",
            reason: error instanceof Error ? error.message : "Witness execution failed",
          },
          null,
          2,
        ),
      );
    } finally {
      setToken("");
      setPending(false);
    }
  }

  if (!readiness.enabled) {
    return <div data-testid="witness-gate" data-enabled="false" className="hidden" />;
  }

  return (
    <section
      className="mt-12 rounded-2xl border border-gold/20 bg-forest-deep/50 p-5 sm:p-6"
      data-testid="witness-gate"
      data-enabled="true"
      data-ready={readiness.ready ? "true" : "false"}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">Operator verification lane</p>
      <h2 className="mt-2 font-serif text-3xl text-parchment">Controlled custody witness</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-parchment/65">
        Evidence is recorded before authority. A target-bound Linear command is written only after an explicit permit,
        then provider state is read back before any receipt can be marked verified.
      </p>

      <div className="mt-5 grid gap-2 text-xs text-parchment/65 sm:grid-cols-4" data-testid="witness-readiness">
        <span data-ready={readiness.witnessTokenConfigured}>Permit: {readiness.witnessTokenConfigured ? "ready" : "blocked"}</span>
        <span data-ready={readiness.exaConfigured}>Exa: {readiness.exaConfigured ? "ready" : "blocked"}</span>
        <span data-ready={readiness.linearConfigured}>Linear: {readiness.linearConfigured ? "ready" : "blocked"}</span>
        <span data-ready={readiness.ledgerConfigured}>Ledger: {readiness.ledgerConfigured ? "ready" : "blocked"}</span>
      </div>

      <p className="mt-4 text-xs text-parchment/50">No secret values are exposed by this page.</p>

      <div className="mt-5 grid gap-3">
        <label className="grid gap-2 text-sm text-parchment/80">
          Witness permit
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="One-time witness permit"
            className="rounded-xl border border-gold/25 bg-forest-deep px-4 py-3 text-parchment outline-none focus:border-gold"
            data-testid="witness-token"
          />
        </label>
        <p className="font-mono text-[11px] text-parchment/45">
          Run ID: <span data-testid="witness-run-id">{witnessRunId || "minting…"}</span>
        </p>
        <button
          type="button"
          onClick={runWitness}
          disabled={!readiness.ready || !token || !witnessRunId || pending}
          className="min-h-11 rounded-xl bg-gold px-5 py-3 font-bold text-forest-deep disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="run-witness"
        >
          {pending ? "Reconciling witness…" : "Run controlled witness"}
        </button>
      </div>

      {result ? (
        <pre className="mt-5 max-h-96 overflow-auto rounded-xl border border-parchment/10 bg-black/30 p-4 text-xs text-parchment/80" data-testid="witness-result">
          {result}
        </pre>
      ) : null}
    </section>
  );
}

function SourceCenter() {
  const readiness = Route.useLoaderData();
  const { statuses, health, error } = useConnectorStatuses();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CONNECTORS.filter((c) => !needle || `${c.name} ${c.role}`.toLowerCase().includes(needle)).sort(
      (a, b) => Number(b.consumerFacing) - Number(a.consumerFacing),
    );
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
        {error ? (
          <p className="mt-4 text-sm text-warn">
            Couldn’t complete provider health checks. No private connector is promoted to Connected without a verified server read.
          </p>
        ) : null}

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
          {list.map((c) => {
            const record = health[c.id];
            const status = statuses[c.id];
            const pathLabel = c.authMode === "lovable_app_connector" ? "Lovable app connector" : PATH_LABEL[c.path];
            return (
              <article key={c.id} data-connector={c.id} className="rounded-2xl border border-parchment/10 bg-forest-deep/40 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-2xl text-parchment">{c.name}</h2>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-parchment/50">
                      {pathLabel}
                      {c.consumerFacing ? "" : " · optional"}
                    </p>
                  </div>
                  <StatusPill status={status} label={CONNECTOR_STATUS_LABEL[status]} />
                </div>
                <p className="mt-3 text-sm leading-6 text-parchment/75">{c.role}</p>
                <p className="mt-3 border-t border-parchment/10 pt-3 text-xs leading-5 text-parchment/55">{c.limits}</p>

                {readiness.enabled && c.setupUrl && status !== "connected" ? (
                  <a
                    href={c.setupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center rounded-full border border-gold/30 px-4 py-2 text-xs font-bold text-gold-soft transition hover:border-gold/60 hover:text-gold"
                    data-testid={`connector-setup-${c.id}`}
                  >
                    {c.setupLabel ?? "Open connector setup"} ↗
                  </a>
                ) : null}

                <details
                  className="mt-3 border-t border-parchment/10 pt-3 text-xs text-parchment/60"
                  data-testid={`connector-proof-${c.id}`}
                >
                  <summary className="cursor-pointer select-none font-semibold text-parchment/70">Connection proof</summary>
                  <div className="mt-2 grid gap-1.5 break-words" data-testid={`connector-health-${c.id}`}>
                    <p>{record?.detail ?? (status === "connecting" ? "Checking provider…" : "No server health receipt available.")}</p>
                    {record ? (
                      <>
                        <p>Capability: <span className="font-mono">{record.capability}</span></p>
                        <p>Checked: <time dateTime={record.checkedAt}>{record.checkedAt}</time></p>
                        {record.lastSuccess ? <p>Last success: <time dateTime={record.lastSuccess}>{record.lastSuccess}</time></p> : null}
                        {record.scope ? (
                          <p>Scope: <span className="font-mono">{Object.entries(record.scope).map(([key, value]) => `${key}=${value}`).join(" · ")}</span></p>
                        ) : null}
                        <p className="font-mono text-[10px] text-parchment/45" data-testid={`connector-receipt-${c.id}`}>
                          Receipt: {record.receipt}
                        </p>
                      </>
                    ) : null}
                  </div>
                </details>
              </article>
            );
          })}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Connected", "A non-mutating server read succeeded in the current health check."],
            ["Available", "Usable without a private connector, but not presented as a verified provider connection."],
            ["Connecting", "The current server health check is still running."],
            ["Needs setup", "Authorize or link the provider before Truth Weaver may call it."],
            ["Degraded", "Configuration or linkage exists, but callability is not verified by a safe read probe."],
            ["Error", "A read probe was attempted but did not produce verified provider state."],
            ["Not configured", "No custom endpoint or server credential has been configured."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-gold/15 p-4">
              <p className="font-semibold text-gold-soft">{t}</p>
              <p className="mt-1 text-xs text-parchment/60">{d}</p>
            </div>
          ))}
        </div>

        <WitnessConsole readiness={readiness} />
      </section>
    </SiteChrome>
  );
}
