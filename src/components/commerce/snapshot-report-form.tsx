import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateMyVerifiedSnapshot } from "@/lib/commerce/snapshot-fulfillment.functions";
import type { NoticeAnalyzerInput } from "@/lib/notice-analyzer";

const EMPTY: NoticeAnalyzerInput = {
  noticeText: "",
  jurisdictionType: "",
  jurisdictionDetail: "",
  receivedDate: "",
  documentTitle: "",
  documentType: "",
  issuer: "",
};

/** Submitted text is used only to generate a server-owned report after payment proof. */
export function SnapshotReportForm({ orderId, userId }: { orderId: string; userId: string }) {
  const [input, setInput] = useState<NoticeAnalyzerInput>({ ...EMPTY });
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  function patch<K extends keyof NoticeAnalyzerInput>(key: K, value: NoticeAnalyzerInput[K]) {
    setInput(previous => ({ ...previous, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || finished) return;
    setFeedback(null); setWorking(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== userId) throw new Error("Please sign in again.");
      const outcome = await generateMyVerifiedSnapshot({ data: {
        authAccessToken: data.session.access_token, orderId, notice: input,
      } });
      if (outcome.state === "unavailable") throw new Error("No report could be created. Check your Shopify payment, account link and notice details.");
      setFinished(true);
      setInput({ ...EMPTY });
      setFeedback(outcome.state === "created"
        ? "Your report was stored privately. Select Check & download above to verify access."
        : "A private report already exists for this purchase. Select Check & download above.");
    } catch {
      setFeedback("Report preparation is unavailable. No download was unlocked or payment claimed. Please check your notice details and try again.");
    } finally {
      setWorking(false);
    }
  }
  if (finished) return <p role="status" className="mt-3 text-sm text-parchment/80">{feedback}</p>;
  return (
    <form onSubmit={event => void submit(event)} className="mt-4 space-y-3 rounded-xl border border-gold/20 p-3">
      <h3 className="font-serif text-lg">Prepare your private Notice Snapshot</h3>
      <p className="text-xs text-parchment/70">Your notice is processed server-side. The report is a research aid, not legal advice. Do not include information you do not wish to process.</p>
      <label className="block text-sm">Notice text (40–25,000 characters)
        <textarea required minLength={40} maxLength={25000} rows={6}
          className="mt-1 w-full rounded-lg border border-gold/30 bg-transparent p-2"
          value={input.noticeText} onChange={event => patch("noticeText", event.target.value)} />
      </label>
      <label className="block text-sm">Jurisdiction layer
        <select required className="mt-1 w-full rounded-lg border border-gold/30 bg-transparent p-2"
          value={input.jurisdictionType}
          onChange={event => patch("jurisdictionType", event.target.value as NoticeAnalyzerInput["jurisdictionType"])}>
          <option value="">Choose</option>
          <option value="federal">U.S. federal</option>
          <option value="state">State, city, or region</option>
          <option value="international">International</option>
        </select>
      </label>
      {input.jurisdictionType !== "federal" && (
        <label className="block text-sm">State, country, court, or other jurisdiction
          <input required maxLength={120} value={input.jurisdictionDetail}
            className="mt-1 w-full rounded-lg border border-gold/30 bg-transparent p-2"
            onChange={event => patch("jurisdictionDetail", event.target.value)} />
        </label>
      )}
      <label className="block text-sm">Date the notice was received
        <input required type="date" value={input.receivedDate}
          className="mt-1 w-full rounded-lg border border-gold/30 bg-transparent p-2"
          onChange={event => patch("receivedDate", event.target.value)} />
      </label>
      <label className="block text-sm">Notice title (optional)
        <input maxLength={160} value={input.documentTitle}
          className="mt-1 w-full rounded-lg border border-gold/30 bg-transparent p-2"
          onChange={event => patch("documentTitle", event.target.value)} />
      </label>
      <button disabled={working} type="submit"
        className="rounded-full border border-gold/40 px-4 py-2 text-sm disabled:opacity-50">
        {working ? "Verifying payment and preparing report..." : "Verify purchase & create report"}
      </button>
      {feedback && <p role="status" className="text-xs text-red-200">{feedback}</p>}
    </form>
  );
}
