import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { requestSnapshotDownload } from "@/lib/commerce/snapshot-download.functions";
import { generateMySnapshotReport } from "@/lib/commerce/snapshot-report-write.functions";

/** A buyer sees only their own entitlement rows via Supabase RLS. */
export function SnapshotDownloadPanel({ userId }: { userId: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prepareFor, setPrepareFor] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [jurisdictionType, setJurisdictionType] = useState<"state" | "federal" | "international">("state");
  const [jurisdictionDetail, setJurisdictionDetail] = useState("");
  const [consentToAiProcessing, setConsentToAiProcessing] = useState(false);
  const [prepareStatus, setPrepareStatus] = useState<string | null>(null);
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
      const result = await requestSnapshotDownload({
        data: { authAccessToken: data.session.access_token, orderId },
      });
      if (!result.available) throw new Error("Report unavailable. Payment, ownership, and private delivery must all be verified.");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report download could not be verified.");
    } finally {
      setPending(null);
    }
  }

  async function generate() {
    if (!prepareFor || preparing || noticeText.trim().length < 40 || !receivedDate ||
      (jurisdictionType !== "federal" && !jurisdictionDetail.trim()) || !consentToAiProcessing) return;
    setPreparing(true);
    setPrepareStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== userId) throw new Error("Sign in again before preparing your report.");
      const result = await generateMySnapshotReport({ data: {
        authAccessToken: data.session.access_token, orderId: prepareFor,
        consentToAiProcessing: true,
        notice: {
          noticeText, receivedDate, documentTitle,
          documentType: "", issuer: "", jurisdictionType, jurisdictionDetail,
        },
      } });
      if (result.state === "unavailable") throw new Error("Report could not be generated. Ownership, payment and delivery must be verified.");
      setPrepareStatus(result.state === "created"
        ? "Your private report was saved. Use Check & download to verify payment and retrieve it."
        : "A report is already stored for this verified order. Use Check & download.");
      setNoticeText("");
      setConsentToAiProcessing(false);
      setPrepareFor(null);
    } catch (cause) {
      setPrepareStatus(cause instanceof Error ? cause.message : "Private report preparation is unavailable.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gold/25 p-5" data-testid="snapshot-download-panel">
      <h2 className="font-serif text-xl">Your Notice Snapshot reports</h2>
      <p className="mt-2 text-sm text-parchment/70">
        A verified Shopify payment and your linked customer account are required for every private download.
        Orders, refunds and access are checked again each time.
      </p>
      {q.isLoading && <p role="status" className="mt-3 text-sm">Checking your report entitlements...</p>}
      {q.isError && <p role="alert" className="mt-3 text-sm text-red-200">Report records could not be loaded.</p>}
      {q.data?.length === 0 && (
        <p className="mt-3 text-sm text-parchment/70">No verified Snapshot purchases appear in this account yet. Draft offers remain unavailable for sale.</p>
      )}
      {q.data?.map(record => {
        // Only the authoritative server can decide expiry; a device clock is not proof.
        const inactive = !!record.revoked_at;
        return (
          <div key={record.order_gid} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/15 p-3">
            <div>
              <p className="text-sm">Notice Snapshot</p>
              <p className="text-xs text-parchment/60">Granted {new Date(record.granted_at).toLocaleDateString()}</p>
            </div>
            <div className="flex flex-wrap gap-2">
            <button type="button" disabled={inactive || pending !== null || preparing}
              onClick={() => { setPrepareFor(record.order_gid); setPrepareStatus(null); }}
              className="rounded-full border border-gold/40 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              Prepare report
            </button>
            <button type="button" disabled={inactive || pending !== null || preparing}
              onClick={() => void download(record.order_gid)}
              className="rounded-full border border-gold/40 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              {inactive ? "Not available" : pending === record.order_gid ? "Verifying..." : "Check & download"}
            </button>
            </div>
          </div>
        );
      })}
      {prepareFor && (
        <div className="mt-5 space-y-3 rounded-xl border border-gold/30 p-4" data-testid="snapshot-report-form">
          <h3 className="font-serif text-lg">Prepare your private Snapshot</h3>
          <p className="text-sm text-parchment/70">Enter the notice text, the jurisdiction and the date you received it.
            The system extracts stated dates and questions, but cannot verify a controlling legal deadline.</p>
          <label className="block text-sm">Notice title (optional)
            <input className="mt-1 w-full rounded-lg border border-gold/30 bg-transparent p-2"
              maxLength={160} value={documentTitle} onChange={e => setDocumentTitle(e.target.value)} />
          </label>
          <label className="block text-sm">Jurisdiction layer
            <select className="mt-1 w-full rounded-lg border border-gold/30 bg-ink p-2" value={jurisdictionType}
              onChange={e => setJurisdictionType(e.target.value as "state" | "federal" | "international")}>
              <option value="state">State, province or local</option><option value="federal">United States federal</option>
              <option value="international">International or another country</option>
            </select>
          </label>
          {jurisdictionType !== "federal" && <label className="block text-sm">Specific jurisdiction
            <input className="mt-1 w-full rounded-lg border border-gold/30 bg-transparent p-2"
              placeholder="e.g., Pennsylvania or Philadelphia" maxLength={120}
              value={jurisdictionDetail} onChange={e => setJurisdictionDetail(e.target.value)} />
          </label>}
          <label className="block text-sm">Date received
            <input type="date" className="mt-1 block rounded-lg border border-gold/30 bg-transparent p-2"
              value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
          </label>
          <label className="block text-sm">Notice text
            <textarea rows={7} maxLength={25000} className="mt-1 w-full rounded-lg border border-gold/30 bg-transparent p-2"
              value={noticeText} onChange={e => setNoticeText(e.target.value)}
              placeholder="Paste the notice text to summarize (at least 40 characters)." />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={consentToAiProcessing}
              onChange={e => setConsentToAiProcessing(e.target.checked)} />
            <span>I understand this notice text will be processed by AI to create a private educational report,
              not a verified legal conclusion or legal advice.</span>
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={preparing || !consentToAiProcessing || noticeText.trim().length < 40 ||
              !receivedDate || (jurisdictionType !== "federal" && !jurisdictionDetail.trim())}
              onClick={() => void generate()}
              className="rounded-full border border-gold/40 px-4 py-2 text-sm disabled:opacity-50">
              {preparing ? "Verifying & preparing..." : "Verify payment & prepare report"}
            </button>
            <button type="button" disabled={preparing} onClick={() => setPrepareFor(null)}
              className="rounded-full border border-gold/20 px-3 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      {prepareStatus && <p role="status" className="mt-3 text-sm">{prepareStatus}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
      <p className="mt-4 text-xs text-parchment/50">
        This is a research aid, not legal advice. A report link expires after 45 seconds and cannot establish a legal deadline.
      </p>
    </section>
  );
}
