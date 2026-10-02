import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  getLinearWitnessReadiness,
  runLinearCustodyWitness,
} from "@/lib/connectors/linear-witness.functions";

export const Route = createFileRoute("/custody-witness")({
  loader: () => getLinearWitnessReadiness(),
  component: CustodyWitnessPage,
});

function StatusPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span
      data-ready={ready ? "true" : "false"}
      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
        ready
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-amber-400/40 bg-amber-400/10 text-amber-200"
      }`}
    >
      {label}: {ready ? "ready" : "blocked"}
    </span>
  );
}

function CustodyWitnessPage() {
  const readiness = Route.useLoaderData();
  const [token, setToken] = useState("");
  const [witnessRunId, setWitnessRunId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setWitnessRunId(crypto.randomUUID());
  }, []);

  async function runWitness() {
    if (!token || !witnessRunId || pending) return;
    setPending(true);
    setResult(null);
    try {
      const response = await runLinearCustodyWitness({
        data: { token, witnessRunId },
      });
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

  return (
    <main className="min-h-screen bg-[#05070b] px-5 py-10 text-[#f4ead0]">
      <div className="mx-auto max-w-4xl">
        <Link to="/connectors" className="text-sm text-amber-300 hover:text-amber-200">
          ← Connector registry
        </Link>

        <section className="mt-6 rounded-3xl border border-amber-300/20 bg-black/40 p-6 shadow-2xl md:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Truth OS custody witness</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-white md:text-5xl">
            Evidence does not authorize its own action.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-300">
            This controlled lane mints one OS evidence envelope from Exa discovery, creates one target-bound Linear
            command, independently reads the provider result back, then reconciles the receipt into the append-only
            custody ledger. A failed or ambiguous write is never retried optimistically.
          </p>

          <div className="mt-6 flex flex-wrap gap-2" data-testid="witness-readiness">
            <StatusPill label="Witness gate" ready={readiness.enabled && readiness.witnessTokenConfigured} />
            <StatusPill label="Exa" ready={readiness.exaConfigured} />
            <StatusPill label="Linear" ready={readiness.linearConfigured} />
            <StatusPill label="Ledger" ready={readiness.ledgerConfigured} />
          </div>

          <div
            className={`mt-6 rounded-2xl border p-4 ${
              readiness.ready
                ? "border-emerald-300/30 bg-emerald-400/5"
                : "border-amber-300/30 bg-amber-300/5"
            }`}
            data-testid="witness-gate"
            data-ready={readiness.ready ? "true" : "false"}
          >
            <p className="font-semibold text-white">
              {readiness.ready ? "Runtime gate ready" : "Runtime gate blocked by configuration"}
            </p>
            <p className="mt-1 text-sm text-stone-400">
              No secret values are exposed here. Missing configuration prevents the provider mutation entirely.
            </p>
          </div>

          <div className="mt-7 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-stone-200">
              Witness permit
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="One-time witness permit"
                className="rounded-xl border border-white/15 bg-black px-4 py-3 text-white outline-none ring-amber-300/40 focus:ring-2"
                data-testid="witness-token"
              />
            </label>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-stone-400">
              Run ID: <span data-testid="witness-run-id">{witnessRunId || "minting…"}</span>
            </div>

            <button
              type="button"
              onClick={runWitness}
              disabled={!readiness.ready || !token || !witnessRunId || pending}
              className="min-h-12 rounded-xl bg-amber-300 px-5 py-3 font-bold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="run-witness"
            >
              {pending ? "Reconciling witness…" : "Run controlled witness"}
            </button>
          </div>

          {result ? (
            <pre
              className="mt-7 max-h-[32rem] overflow-auto rounded-2xl border border-white/10 bg-black/70 p-4 text-xs leading-6 text-emerald-200"
              data-testid="witness-result"
            >
              {result}
            </pre>
          ) : null}
        </section>
      </div>
    </main>
  );
}
