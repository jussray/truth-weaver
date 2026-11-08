import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, LoaderCircle, RefreshCw } from "lucide-react";

import { StateBox, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";
import { checkMyPaidOrders, downloadMyOrderReport, getMyOrderReports } from "@/lib/commerce/order-report.functions";

type ReportList = Awaited<ReturnType<typeof getMyOrderReports>>;
type Preview = { orderGid: string; url: string; filename: string };

async function currentToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Individual order PDFs; no payment is inferred from a database status alone. */
export function PaidOrderReports() {
  const listReports = useServerFn(getMyOrderReports);
  const checkOrders = useServerFn(checkMyPaidOrders);
  const openReport = useServerFn(downloadMyOrderReport);
  const [reports, setReports] = useState<ReportList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await currentToken();
        const result: ReportList = token
          ? await listReports({ headers: { Authorization: "Bearer " + token } })
          : { state: "not_authenticated", reports: [] };
        if (active) setReports(result);
      } catch {
        if (active) setReports({ state: "unavailable", reports: [] });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [listReports]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function reconcile() {
    setBusy("check");
    setMessage("");
    try {
      const token = await currentToken();
      if (!token) { setMessage("Sign in to check for your reports."); return; }
      const outcome = await checkOrders({ headers: { Authorization: "Bearer " + token } });
      if (outcome.state === "unavailable") {
        setMessage("The Shopify order check is unavailable. Nothing was granted.");
      } else if (outcome.state === "not_authenticated") {
        setMessage("Sign in again before checking your purchases.");
      } else {
        setMessage(outcome.ready > 0
          ? "Your completed report was located. Open it below to recheck payment."
          : "No new completed report found. Processing may still be pending.");
      }
      setReports(await listReports({ headers: { Authorization: "Bearer " + token } }));
    } catch {
      setMessage("We could not verify your paid orders. No document was released.");
    } finally { setBusy(null); }
  }

  async function viewOrder(orderGid: string) {
    setBusy(orderGid);
    setMessage("");
    try {
      const token = await currentToken();
      if (!token) { setMessage("Sign in to view this report."); return; }
      const result = await openReport({
        data: { orderGid },
        headers: { Authorization: "Bearer " + token },
      });
      if (result.state !== "ready") {
        setMessage(result.state === "payment_not_confirmed"
          ? "Current Shopify payment could not be verified. The report remains locked."
          : "The report is not available for this account or order.");
        return;
      }
      const binary = atob(result.base64);
      if (result.mediaType !== "application/pdf" || binary.length > 524288 || !binary.startsWith("%PDF-")) {
        setMessage("The downloaded report failed file validation."); return;
      }
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setPreview({ orderGid, url, filename: result.filename });
    } catch {
      setMessage("The order could not be independently verified. No document was released.");
    } finally { setBusy(null); }
  }

  function savePreview() {
    if (!preview) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = preview.filename;
    link.rel = "noreferrer noopener";
    link.referrerPolicy = "no-referrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return <section aria-labelledby="per-order-reports-heading" className="mb-6">
    <h2 id="per-order-reports-heading" className="font-serif text-2xl text-parchment">Personalized reports by paid order</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-parchment/65">
      Each report is tied to your saved analysis and a particular Shopify order.
      Payment, ownership and document readiness are checked again before viewing.
    </p>
    <button type="button" onClick={() => void reconcile()} disabled={busy !== null || loading} className={tw.ghost + " mt-4 inline-flex items-center gap-2"}>
      {busy === "check" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
      Check for my paid orders
    </button>
    <div aria-live="polite" aria-busy={loading || busy !== null} className="mt-4 space-y-3">
      {loading && <StateBox kind="loading">Loading saved reports…</StateBox>}
      {!loading && reports?.state === "not_authenticated" && <StateBox kind="empty">Sign in to see personalized paid reports.</StateBox>}
      {!loading && reports?.state === "unavailable" && <StateBox kind="error">The report database is unavailable. No payment has been confirmed.</StateBox>}
      {!loading && reports?.state === "ok" && reports.reports.length === 0 && <StateBox kind="empty">No personalized reports recorded yet. First save an analysis, then purchase an eligible report.</StateBox>}
      {!loading && reports?.state === "ok" && reports.reports.map((row) => (
        <article key={row.orderGid} className={tw.card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={tw.label}>Shopify order {row.orderName}</p>
              <h3 className="mt-1 font-serif text-xl text-parchment">{row.items.join(" + ") || "Personalized report"}</h3>
              <p className="mt-1 text-sm text-parchment/65">
                Stored status: {row.status}. This is not current payment proof.
              </p>
            </div>
            {row.status === "ready" && <button type="button" disabled={busy !== null} onClick={() => void viewOrder(row.orderGid)}
              className={tw.btn + " inline-flex items-center gap-2"}>
              {busy === row.orderGid ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
              View report
            </button>}
          </div>
        </article>
      ))}
      {message && <StateBox kind="empty">{message}</StateBox>}
      {preview && <div className={tw.card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-parchment">Verified report for order {preview.orderGid.split("/").at(-1)}</p>
          <button type="button" className={tw.btn + " inline-flex items-center gap-2"} onClick={savePreview}>
            <Download className="h-4 w-4" aria-hidden /> Download this PDF
          </button>
        </div>
        <iframe title="Personalized paid report preview" src={preview.url} className="mt-4 h-[65vh] w-full rounded-lg bg-white" />
      </div>}
    </div>
  </section>;
}
