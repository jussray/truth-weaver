import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import type { Json } from "@/integrations/supabase/types";
import { authed } from "@/lib/merchant/authed-call";
import { createVendorInvite, listAuditLog } from "@/lib/merchant/portal.functions";

export const Route = createFileRoute("/merchant/audit-log")({
  head: () => ({ meta: [{ title: "Activity Log | Truth Weaver Merchant" }, { name: "description", content: "Every merchant price change, customer-detail view and invite, in order." }, { property: "og:title", content: "Activity Log | Truth Weaver Merchant" }, { property: "og:description", content: "Recorded merchant changes, customer-detail views and invites." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AuditPage,
});

type Rows = Awaited<ReturnType<typeof listAuditLog>>;

/** An audit receipt may contain arbitrary JSON, never assume an object shape. */
function priceFromAuditState(value: Json | null): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value["price"];
  if (typeof candidate === "string") return candidate;
  if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  return null;
}

function AuditPage() {
  const [rows, setRows] = useState<Rows | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [code, setCode] = useState<string | null>(null);

  const load = () => authed(listAuditLog).then(setRows).catch(() => setError("The activity log could not be loaded."));
  useEffect(() => { load(); }, []);

  async function invite() {
    try {
      const r = await authed(createVendorInvite, { label });
      setCode(r.code); setLabel(""); load();
    } catch { setError("Invite could not be created."); }
  }

  return (
    <section aria-labelledby="audit-h">
      <h1 id="audit-h" className="font-serif text-3xl">Activity log</h1>
      {error && <div role="alert" className="mt-4 rounded-lg border border-danger/50 p-3 text-sm text-danger">{error}</div>}

      <div className="mt-6 rounded-xl border border-gold/15 bg-forest-deep/30 p-4">
        <h2 className="font-serif text-lg">Invite a vendor (lawyer, paralegal)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input aria-label="Invite label" value={label} onChange={(e) => setLabel(e.currentTarget.value)} placeholder="Who is this for?" className="flex-1 rounded-md border border-gold/25 bg-ink px-2 py-1.5 text-sm" />
          <button type="button" disabled={label.trim().length < 2} onClick={invite} className="rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-ink disabled:opacity-40">Create invite</button>
        </div>
        {code && <p className="mt-3 text-sm">One-time code (shown once, expires in 7 days): <code className="break-all rounded bg-ink px-1 text-gold">{code}</code></p>}
      </div>

      {!rows && !error && <p role="status" className="mt-6 text-parchment/60">Loading…</p>}
      {rows && rows.length === 0 && <p className="mt-6 text-parchment/60">No activity yet.</p>}
      <ol data-testid="audit-rows" className="mt-6 grid gap-2 text-sm">
        {rows?.map((r) => (
          <li key={r.id} data-outcome={r.outcome} className="rounded-lg border border-gold/10 p-3">
            <span className="font-semibold text-gold">{r.action}</span> · {r.outcome} · <span className="text-parchment/60">{new Date(r.created_at).toLocaleString()}</span>
            <div className="text-parchment/70">
              {r.target.split("/").pop()}
              {priceOf(r.before_state) && ` · $${priceOf(r.before_state)}`}
              {priceOf(r.requested_state) && ` → $${priceOf(r.requested_state)}`}
              {r.detail && ` · ${r.detail}`}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Audit states are untyped JSON; only a string `price` field is displayed. */
function priceOf(state: Json | null): string | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const price = state["price"];
  return typeof price === "string" && price ? price : null;
}
