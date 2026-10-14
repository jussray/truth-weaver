import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { requestSnapshotDownload } from "@/lib/commerce/snapshot-download.functions";
import { SnapshotReportForm } from "./snapshot-report-form";

/** Entitlements are owner-scoped by Supabase RLS. Payment and download remain server-gated. */
export function SnapshotDownloadPanel({ userId }: { userId: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [prepareFor, setPrepareFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["tw-snapshot-entitlements", userId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from("tw_snapshot_entitlements")
        .select("order_gid, granted_at, revoked_at, expires_at")
        .eq("auth_user_id", userId).order("granted_at", { ascending: false });
      if (queryError) throw new Error("Snapshot purchase records are unavailable.");
      return data ?? [];
    },
  });

  async function download(orderId: string) {
    setError(null);
    setPending(orderId);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== userId) throw new Error("Sign in again before requesting a report.");
      const result = await requestSnapshotDownload({ data: {
        authAccessToken: data.session.access_token, orderId,
      } });
      if (!result.available) throw new Error("Report unavailable. Payment, ownership and delivery must all be verified.");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report download could not be verified.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gold/25 p-5" data-testid="snapshot-download-panel">
      <h2 className="font-serif text-xl">Your Notice Snapshot reports</h2>
      <p className="mt-2 text-sm text-parchment/70">
        A verified Shopify payment and linked customer account are required. Orders, refunds and
        report access are checked afresh for every private download.
      </p>
      {q.isLoading && <p role="status" className="mt-3 text-sm">Checking your report entitlements...</p>}
      {q.isError && <p role="alert" className="mt-3 text-sm text-red-200">Report records could not be loaded.</p>}
      {q.data?.length === 0 && (
        <p className="mt-3 text-sm text-parchment/70">
          No verified Snapshot purchases appear in this account. Draft offers are not available for sale.
        </p>
      )}
      {q.data?.map(record => {
        const inactive = !!record.revoked_at; // Expiry is authoritative only on the server.
        return (
          <div key={record.order_gid} className="mt-3 rounded-lg border border-gold/15 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm">Notice Snapshot</p>
                <p className="text-xs text-parchment/60">Granted {new Date(record.granted_at).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={inactive || pending !== null}
                  onClick={() => setPrepareFor(prepareFor === record.order_gid ? null : record.order_gid)}
                  className="rounded-full border border-gold/40 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                  {inactive ? "Not available" : prepareFor === record.order_gid ? "Close form" : "Prepare report"}
                </button>
                <button type="button" disabled={inactive || pending !== null}
                  onClick={() => void download(record.order_gid)}
                  className="rounded-full border border-gold/40 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                  {inactive ? "Not available" : pending === record.order_gid ? "Verifying..." : "Check & download"}
                </button>
              </div>
            </div>
            {!inactive && prepareFor === record.order_gid &&
              <SnapshotReportForm key={record.order_gid} orderId={record.order_gid} userId={userId} />}
          </div>
        );
      })}
      {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
      <p className="mt-4 text-xs text-parchment/50">
        This is a research aid, not legal advice. A report link expires after 45 seconds and cannot establish a legal deadline.
      </p>
    </section>
  );
}
