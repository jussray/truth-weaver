import { Faq, NOTICE_FAQ } from "@/components/storefront/faq";
import { pageHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  AlertTriangle,
  Clock3,
  FileSearch,
  ListChecks,
  LoaderCircle,
  MessagesSquare,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { SiteChrome } from "@/components/storefront/site-chrome";
import { extractNoticePdfText } from "@/lib/extract-notice-pdf";
import { analyzeLegalNotice } from "@/lib/notice-analyzer.functions";
import {
  NOTICE_TEXT_MAX,
  type NoticeAnalyzerInput,
  type NoticeAnalyzerResult,
} from "@/lib/notice-analyzer";
import { COUNSEL_STORAGE_KEY, toStoredAnalysis } from "@/lib/counsel-document";

export const Route = createFileRoute("/notice-analyzer")({
  component: NoticeAnalyzerPage,
  head: () =>
    pageHead({ path: '/notice-analyzer', title: 'Legal Notice Analyzer: Understand a Notice | Truth Weaver Counsel', description: 'Got a landlord, court, debt or government notice? Add it to see the dates, demands and questions to ask a lawyer. Check every finding against the original notice and official law.', breadcrumbs: [{ name: "Home", path: "/" }, { name: 'Notice Analyzer', path: '/notice-analyzer' }] }),
});

type FormState = NoticeAnalyzerInput;

const INITIAL_FORM: FormState = {
  noticeText: "",
  jurisdictionType: "",
  jurisdictionDetail: "",
  documentTitle: "",
  documentType: "",
  issuer: "",
  receivedDate: "",
};

function NoticeAnalyzerPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<NoticeAnalyzerResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [fileMessage, setFileMessage] = useState("");
  const [scanRejected, setScanRejected] = useState("");
  const [consent, setConsent] = useState(false);
  // Hydration gate: a file picked before React attaches its input handler can
  // be silently dropped on SSR pages. Accept uploads only after mount.
  const [uploadReady, setUploadReady] = useState(false);
  useEffect(() => setUploadReady(true), []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleNoticeFile(event: ChangeEvent<HTMLInputElement>) {
    setFileMessage("");
    setScanRejected("");
    setResult(null);
    setConsent(false);
    updateField("noticeText", "");
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const isPlainText = file.type === "text/plain" || /\.txt$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImage = /^image\/(png|jpeg|webp)$/.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!isPlainText && !isPdf && !isImage) {
      setFileMessage("Supported: PDF, photo (PNG/JPG/WebP), or .txt.");
      return;
    }
    const ocrNote = "Read automatically — check every date, name and amount against the original before analysis.";

    try {
      if (isPlainText) {
        if (file.size > 100_000) throw new Error("Text file is too large (100 KB maximum).");
        const text = await file.text();
        if (text.length > NOTICE_TEXT_MAX) throw new Error("Notice text is over the 25,000-character limit.");
        updateField("noticeText", text);
        setFileMessage(`Loaded ${file.name}. Review the text before analysis.`);
      } else if (isImage) {
        const { ocrNoticeImage } = await import("@/lib/ocr-notice");
        const { text, averageConfidence } = await ocrNoticeImage(file, setFileMessage);
        updateField("noticeText", text);
        setFileMessage(`Scanned ${file.name}. Estimated reading clarity ${Math.round(averageConfidence)}%. ${ocrNote}`);
      } else {
        setFileMessage("Extracting selectable text locally. No notice has been submitted.");
        try {
          const { text, pages } = await extractNoticePdfText(file);
          updateField("noticeText", text);
          setFileMessage(`Loaded ${file.name} (${pages} page${pages === 1 ? "" : "s"}). Review the text before analysis.`);
        } catch (cause) {
          if (!(cause instanceof Error) || !cause.message.startsWith("No sufficient selectable text")) throw cause;
          const { ocrNoticePdf } = await import("@/lib/ocr-notice");
          const { text, averageConfidence } = await ocrNoticePdf(file, setFileMessage);
          updateField("noticeText", text);
          setFileMessage(`Scanned ${file.name}. Estimated reading clarity ${Math.round(averageConfidence)}%. ${ocrNote}`);
        }
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "OcrUnreadableError") {
        updateField("noticeText", "");
        setScanRejected(cause.message);
        setFileMessage("Scan rejected. Nothing was analyzed.");
        return;
      }
      setFileMessage(cause instanceof Error ? cause.message : "The document could not be read. Paste the text instead.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) {
      setError("Consent to sending the reviewed notice text for analysis is required.");
      return;
    }
    setPending(true);
    setError("");
    setResult(null);

    try {
      const response = await analyzeLegalNotice({ data: form });
      setResult(response);
      try {
        // Session-only, this tab only. Raw notice text is never stored.
        sessionStorage.setItem(COUNSEL_STORAGE_KEY, JSON.stringify(toStoredAnalysis(form, response)));
      } catch {
        // Storage can be unavailable (private mode / quota). The on-screen result is unaffected.
      }
    } catch {
      setError(
        "We couldn’t analyze this notice right now. No legal conclusion was generated. Check the details you entered, then try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const detailRequired = form.jurisdictionType !== "" && form.jurisdictionType !== "federal";

  return (
    <SiteChrome>
      <section className="border-b border-gold/15 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--violet-accent)_20%,transparent),transparent_36%),linear-gradient(180deg,var(--forest-deep),var(--ink))] px-5 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex max-w-3xl flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-gold">
              <FileSearch className="h-4 w-4" aria-hidden /> Legal Notice Analyzer
            </span>
            <h1 className="font-serif text-4xl font-semibold leading-tight text-parchment sm:text-5xl lg:text-6xl">
              Understand your legal notice.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-parchment/75 sm:text-lg">
              Review the dates and demands in your notice, see what needs checking, and prepare questions for a qualified lawyer. The sender’s claims are not proof of your legal obligations.
            </p>
          </div>

          <div data-testid="notice-authority" className="mt-8 grid gap-3 rounded-2xl border border-gold/35 bg-ink/70 p-5 sm:grid-cols-[auto_1fr] sm:items-start">
            <ShieldCheck className="h-8 w-8 text-gold" aria-hidden />
            <div>
              <div className="flex flex-wrap gap-2">
                <span data-authority="non-authorizing" className="rounded-full border border-warn/50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-warn">Research only — not permission to act</span>
                <span className="rounded-full border border-gold/50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-gold">GOVERNING LAW IS THE AUTHORITY</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-parchment/75">
                This helps you read a notice. It is not legal advice, representation, a filing, or verified law. Confirm deadlines, duties, fees and available options with official sources and a qualified lawyer where the notice applies.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink px-5 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={handleSubmit} inert={!uploadReady} aria-busy={!uploadReady} className="space-y-5" data-testid="notice-analyzer-form">
            <div className="rounded-2xl border border-gold/20 bg-forest-deep/35 p-5">
              <h2 className="font-serif text-2xl text-parchment">Where did this notice come from?</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm text-parchment/80">
                  Legal system
                  <select
                    data-testid="jurisdiction-type"
                    value={form.jurisdictionType}
                    onChange={(event) => updateField("jurisdictionType", event.currentTarget.value as FormState["jurisdictionType"])}
                    className="rounded-xl border border-parchment/15 bg-ink px-3 py-3 text-parchment outline-none focus:border-gold/60"
                  >
                    <option value="" disabled>Choose the legal system *</option>
                    <option value="federal">U.S. Federal</option>
                    <option value="state">U.S. State / Territory</option>
                    <option value="international">International / Supranational</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-parchment/80">
                  Country, state or region {detailRequired ? "*" : "(optional)"}
                  <input
                    data-testid="jurisdiction-detail"
                    required={detailRequired}
                    value={form.jurisdictionDetail}
                    onChange={(event) => updateField("jurisdictionDetail", event.currentTarget.value)}
                    placeholder="e.g. Pennsylvania or European Union"
                    className="rounded-xl border border-parchment/15 bg-ink px-3 py-3 text-parchment outline-none placeholder:text-parchment/30 focus:border-gold/60"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-forest-deep/35 p-5">
              <h2 className="font-serif text-2xl text-parchment">About your document</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <MetadataField label="Document title" value={form.documentTitle} onChange={(value) => updateField("documentTitle", value)} placeholder="Notice title" />
                <MetadataField label="Document type" value={form.documentType} onChange={(value) => updateField("documentType", value)} placeholder="Demand, hearing notice, cure notice..." />
                <MetadataField label="Issuer / sender" value={form.issuer} onChange={(value) => updateField("issuer", value)} placeholder="Agency, court, landlord, company..." />
                <label className="grid gap-2 text-sm text-parchment/80">
                  Relevant notice date (received or event) *
                  <input
                    data-testid="notice-relevant-date"
                    type="date"
                    required
                    value={form.receivedDate}
                    onChange={(event) => updateField("receivedDate", event.currentTarget.value)}
                    className="rounded-xl border border-parchment/15 bg-ink px-3 py-3 text-parchment outline-none focus:border-gold/60"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-forest-deep/35 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-2xl text-parchment">Add the notice</h2>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gold/35 px-3 py-2 text-xs font-bold text-gold hover:bg-gold/10">
                  <Upload className="h-4 w-4" aria-hidden /> Load PDF / photo / .txt
                  <input type="file" accept=".pdf,application/pdf,.txt,text/plain,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" disabled={!uploadReady} onChange={handleNoticeFile} className="sr-only" />
                </label>
              </div>
              <p className="mt-2 text-xs leading-5 text-parchment/55">
                PDFs (up to 5 MB), photos and .txt are read on your device first. Scanned PDFs (up to 6 pages) and photos are read automatically and may contain mistakes. After you consent and choose Analyze, the reviewed text and details you entered are sent for analysis; they do not stay only on your device.
              </p>
              <p role="alert" className="mt-2 text-xs leading-5 text-warn">Automatic reading is not verification. Scans below 85% estimated clarity are rejected. Even a clear scan may have missing words or incorrect dates. Compare every deadline, fee, amount and name with the original before consenting.</p>
              <p data-testid="notice-file-status" role="status" className="mt-2 min-h-5 text-xs text-gold-soft">
                {fileMessage || (uploadReady ? "No document loaded. You can also paste text below." : "Preparing document upload...")}
              </p>
              {scanRejected && (
                <div data-testid="ocr-retake" role="alert" className="mt-3 flex gap-3 rounded-xl border border-danger/60 bg-danger/10 p-4 text-sm text-parchment">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden />
                  <div>
                    <p className="font-bold text-danger">Retake required — scan too blurry</p>
                    <p className="mt-1 leading-6">{scanRejected}</p>
                  </div>
                </div>
              )}
              <textarea
                data-testid="notice-text"
                required
                minLength={40}
                maxLength={NOTICE_TEXT_MAX}
                rows={14}
                value={form.noticeText}
                onChange={(event) => updateField("noticeText", event.currentTarget.value)}
                placeholder="Paste the notice text here..."
                className="mt-4 w-full resize-y rounded-xl border border-parchment/15 bg-ink px-4 py-3 text-sm leading-6 text-parchment outline-none placeholder:text-parchment/30 focus:border-gold/60"
              />
              <div className="mt-2 flex justify-between text-[11px] text-parchment/45">
                <span>Keep only the text needed for analysis.</span>
                <span>{form.noticeText.length.toLocaleString()} / {NOTICE_TEXT_MAX.toLocaleString()}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm leading-6 text-parchment/75">
              <input
                data-testid="notice-consent"
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.currentTarget.checked)}
                className="mt-1 accent-gold"
              />
              I reviewed the notice text and agree to send that text and the details I entered for AI analysis. Remove private details that are not needed before continuing.
            </label>
            <button
              data-testid="analyze-notice"
              type="submit"
              disabled={pending || !consent}
              className="foil-surface inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-bold text-ink disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <FileSearch className="h-5 w-5" aria-hidden />}
              {pending ? "Reading your notice..." : "Analyze notice"}
            </button>

            {error ? (
              <div role="alert" data-testid="analysis-error" className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm leading-6 text-parchment">
                <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden /><span>{error}</span></div>
              </div>
            ) : null}
          </form>

          <div className="lg:sticky lg:top-28 lg:self-start">
            {result ? <AnalysisResult result={result} /> : <EmptyResult />}
          </div>
        </div>
      </section>
      <Faq id="notice-questions" title="Questions about the Notice Analyzer" items={NOTICE_FAQ} />
    </SiteChrome>
  );
}

function MetadataField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="grid gap-2 text-sm text-parchment/80">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className="rounded-xl border border-parchment/15 bg-ink px-3 py-3 text-parchment outline-none placeholder:text-parchment/30 focus:border-gold/60"
      />
    </label>
  );
}

function EmptyResult() {
  return (
    <section data-testid="analysis-empty" className="rounded-3xl border border-gold/20 bg-forest-deep/30 p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Analysis workspace</p>
      <h2 className="mt-3 font-serif text-3xl text-parchment">Your notice review will appear here.</h2>
      <p className="mt-4 text-sm leading-6 text-parchment/65">
        Add your notice and review the text before sending it. If analysis is unavailable, we’ll tell you instead of inventing an answer. Dates and demands still need checking against the original and official law.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          [Clock3, "Critical dates", "Stated dates and response windows"],
          [ListChecks, "Demands", "Actions the sender claims are required"],
          [MessagesSquare, "Questions for counsel", "Specific issues worth raising"],
          [AlertTriangle, "Uncertainties", "What still needs official verification"],
        ].map(([Icon, title, body]) => {
          const ItemIcon = Icon as typeof Clock3;
          return (
            <div key={title as string} className="rounded-2xl border border-parchment/10 bg-ink/50 p-4">
              <ItemIcon className="h-5 w-5 text-gold" aria-hidden />
              <h3 className="mt-3 font-semibold text-parchment">{title as string}</h3>
              <p className="mt-1 text-xs leading-5 text-parchment/55">{body as string}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AnalysisResult({ result }: { result: NoticeAnalyzerResult }) {
  return (
    <section data-testid="analysis-result" className="space-y-5 rounded-3xl border border-gold/30 bg-forest-deep/35 p-6 sm:p-8">
      <div>
        <div className="flex flex-wrap gap-2">
          <span data-authority-state={result.authority.status} className="rounded-full border border-warn/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-warn">Research only — not permission to act</span>
          <span className="rounded-full border border-gold/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-gold">{result.authority.statement}</span>
        </div>
        <h2 className="mt-4 font-serif text-3xl text-parchment">Notice analysis</h2>
        <p className="mt-2 text-xs leading-5 text-parchment/55">{result.authority.disclaimer}</p>
        <Link
          to="/fulfillment"
          data-testid="open-counsel-document"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <FileSearch className="h-4 w-4" aria-hidden /> Open Counsel document (PDF)
        </Link>
      </div>

      <ResultSection icon={Clock3} title="Critical dates & deadlines">
        {result.criticalDeadlines.length ? result.criticalDeadlines.map((item, index) => (
          <article key={`${item.label}-${index}`} className="rounded-xl border border-parchment/10 bg-ink/45 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-parchment">{item.label}</h3>
              <span className="rounded-full border border-gold/30 px-2 py-1 text-[10px] uppercase tracking-wider text-gold">{item.urgency}</span>
            </div>
            <p className="mt-2 text-sm text-gold-soft">{item.date ?? "No explicit date extracted"}</p>
            <p className="mt-2 text-xs leading-5 text-parchment/60">Evidence from supplied notice: {item.evidence}</p>
            <p className="mt-2 text-[11px] font-semibold text-gold">From your notice — not verified law</p>
            <p className="mt-2 text-[11px] font-semibold text-warn">Needs official verification</p>
          </article>
        )) : <p className="text-sm text-parchment/55">No explicit deadlines were extracted from the supplied text.</p>}
      </ResultSection>

      <ResultSection icon={ListChecks} title="What the sender asks you to do">
        {result.obligations.length ? result.obligations.map((item, index) => (
          <article key={`${item.action}-${index}`} className="rounded-xl border border-parchment/10 bg-ink/45 p-4">
            <p className="text-sm leading-6 text-parchment">{item.action}</p>
            {item.claimedBy ? <p className="mt-1 text-xs text-gold-soft">Claimed by: {item.claimedBy}</p> : null}
            <p className="mt-2 text-xs leading-5 text-parchment/60">Evidence: {item.evidence}</p>
            {item.needsVerification ? <p className="mt-2 text-[11px] font-semibold text-warn">Needs official verification</p> : null}
          </article>
        )) : <p className="text-sm text-parchment/55">No demanded actions were extracted from the supplied text.</p>}
      </ResultSection>

      <ResultSection icon={MessagesSquare} title="Questions for a lawyer">
        <ul className="space-y-2 text-sm leading-6 text-parchment/80">
          {result.questionsForCounsel.map((question) => <li key={question} className="rounded-xl border border-parchment/10 bg-ink/45 p-3">{question}</li>)}
        </ul>
      </ResultSection>

      <ResultSection icon={AlertTriangle} title="What still needs checking">
        <ul className="space-y-2 text-sm leading-6 text-parchment/80">
          {result.uncertainties.map((uncertainty) => <li key={uncertainty} className="rounded-xl border border-parchment/10 bg-ink/45 p-3">{uncertainty}</li>)}
        </ul>
      </ResultSection>
    </section>
  );
}

function ResultSection({ icon: Icon, title, children }: { icon: typeof Clock3; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gold/15 pt-5">
      <h3 className="flex items-center gap-2 font-serif text-xl text-parchment"><Icon className="h-5 w-5 text-gold" aria-hidden /> {title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}
