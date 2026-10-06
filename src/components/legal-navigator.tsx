import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Fingerprint,
  Globe2,
  LoaderCircle,
  Scale,
  Search,
  ShieldCheck,
} from "lucide-react";

import { CONTINUITY_COOKIE_NAME, writeContinuityCookie } from "@/lib/continuity";
import { researchLegalSituation } from "@/lib/legal-navigator.functions";

type ResearchResult = Awaited<ReturnType<typeof researchLegalSituation>>;

type FormState = {
  question: string;
  place: string;
  eventDate: string;
  asOfDate: string;
  facts: string;
};

const EMPTY_FORM: FormState = {
  question: "",
  place: "",
  eventDate: "",
  asOfDate: "",
  facts: "",
};

function readPredecessorFingerprint() {
  if (typeof document === "undefined") return "";
  const prefix = CONTINUITY_COOKIE_NAME + "=";
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!raw) return "";
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(prefix.length))) as { f?: string };
    return typeof parsed.f === "string" ? parsed.f : "";
  } catch {
    return "";
  }
}

function StateBadge({ state }: { state: string }) {
  const strong = state === "VERIFIED LAW";
  return (
    <span
      className={
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] " +
        (strong
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-gold/35 bg-gold/10 text-gold")
      }
    >
      {state}
    </span>
  );
}

export function LegalNavigator() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const next = await researchLegalSituation({
        data: {
          ...form,
          predecessorFingerprint: readPredecessorFingerprint(),
        },
      });
      setResult(next);
      writeContinuityCookie(next.continuity);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Truth Weaver could not complete this research request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="legal-research" className="border-t border-gold/15 bg-forest-deep/40 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-gold">Truth Weaver legal navigator</p>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.02] text-parchment sm:text-5xl">
              Start with the situation. We trace the law behind it.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-parchment/70">
              Give Truth Weaver the problem, the place, and the relevant time. It resolves the legal layers, searches registered official sources live, checks citations against retrieved material where possible, and shows what is verified, unverified, missing, or stale.
            </p>
            <div className="mt-6 rounded-2xl border border-gold/25 bg-gold/5 p-4 text-sm leading-6 text-parchment/85">
              <strong>Governing law is the authority.</strong> Model output and legal books can help explain or discover law, but they cannot silently become governing law.
            </div>
            <div className="mt-4 rounded-2xl border border-violet-accent/25 bg-violet-accent/10 p-4 text-sm leading-6 text-parchment/80">
              <strong>Place matters:</strong> “Africa” is too broad. A legal answer may require country, state/province/region, county, city, court, or another jurisdiction layer.
            </div>
          </div>

          <div className="space-y-6">
            <form onSubmit={submit} className="grid gap-4 rounded-3xl border border-gold/20 bg-ink/70 p-5 sm:p-6" data-legal-navigator>
              <label className="grid gap-2 text-sm text-parchment/85">
                What are you trying to understand?
                <textarea
                  data-testid="legal-question"
                  required
                  minLength={3}
                  rows={3}
                  value={form.question}
                  onChange={(event) => update("question", event.currentTarget.value)}
                  placeholder="Example: I want to find a rent-to-own or owner-financed home. What rules and options matter?"
                  className="w-full resize-y rounded-xl border border-parchment/15 bg-ink px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchment/30 focus:border-gold/60"
                />
              </label>

              <label className="grid gap-2 text-sm text-parchment/85">
                Place / jurisdiction
                <input
                  data-testid="legal-place"
                  required
                  value={form.place}
                  onChange={(event) => update("place", event.currentTarget.value)}
                  placeholder="Philadelphia, Pennsylvania, United States · Nigeria · Thailand"
                  className="rounded-xl border border-parchment/15 bg-ink px-4 py-3 text-parchment outline-none placeholder:text-parchment/30 focus:border-gold/60"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm text-parchment/85">
                  When did the event happen?
                  <input
                    type="date"
                    value={form.eventDate}
                    onChange={(event) => update("eventDate", event.currentTarget.value)}
                    className="rounded-xl border border-parchment/15 bg-ink px-4 py-3 text-parchment outline-none focus:border-gold/60"
                  />
                </label>
                <label className="grid gap-2 text-sm text-parchment/85">
                  Law as of date
                  <input
                    type="date"
                    value={form.asOfDate}
                    onChange={(event) => update("asOfDate", event.currentTarget.value)}
                    className="rounded-xl border border-parchment/15 bg-ink px-4 py-3 text-parchment outline-none focus:border-gold/60"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm text-parchment/85">
                Facts that may matter
                <textarea
                  rows={5}
                  value={form.facts}
                  onChange={(event) => update("facts", event.currentTarget.value)}
                  placeholder="What happened? What document, transaction, court, agency, property, deadline, or other fact could change the rule?"
                  className="w-full resize-y rounded-xl border border-parchment/15 bg-ink px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchment/30 focus:border-gold/60"
                />
              </label>

              <button
                data-testid="research-law"
                type="submit"
                disabled={pending}
                className="foil-surface inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-bold text-ink disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Search className="h-5 w-5" aria-hidden />}
                {pending ? "Researching official sources..." : "Research my situation"}
              </button>

              {error ? (
                <div role="alert" className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-parchment">
                  {error}
                </div>
              ) : null}
            </form>

            {result ? (
              <section data-testid="legal-research-result" className="space-y-5 rounded-3xl border border-gold/25 bg-ink/75 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <StateBadge state={result.researchStatus} />
                      <StateBadge state={result.authority.status} />
                    </div>
                    <h3 className="mt-3 font-serif text-3xl text-parchment">Research findings</h3>
                    <p className="mt-2 text-sm leading-6 text-parchment/65">{result.jurisdictionSummary}</p>
                  </div>
                  <Scale className="h-9 w-9 text-gold" aria-hidden />
                </div>

                <div className="rounded-2xl border border-parchment/10 bg-forest-deep/25 p-4">
                  <h4 className="flex items-center gap-2 font-semibold text-parchment">
                    <Globe2 className="h-4 w-4 text-gold" aria-hidden /> Jurisdiction stack
                  </h4>
                  <p className="mt-2 text-sm text-parchment/75">
                    {result.jurisdiction.layers.length ? result.jurisdiction.layers.join(" → ") : "Not resolved"}
                  </p>
                  {result.jurisdiction.missing.length ? (
                    <ul className="mt-3 space-y-1 text-xs leading-5 text-warn">
                      {result.jurisdiction.missing.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  ) : null}
                </div>

                {result.findings.length ? (
                  <div className="space-y-4">
                    {result.findings.map((finding, index) => (
                      <article key={index} className="rounded-2xl border border-parchment/10 bg-forest-deep/20 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StateBadge state={finding.truthState} />
                          <span className="text-[11px] uppercase tracking-wider text-parchment/45">{finding.authorityType}</span>
                        </div>
                        <h4 className="mt-3 font-semibold text-parchment">{finding.proposition}</h4>
                        <p className="mt-2 text-sm leading-6 text-parchment/75">{finding.explanation}</p>
                        {finding.citation ? (
                          <p className="mt-3 font-mono text-xs text-gold-soft">
                            Citation: {finding.citation} {finding.citationVerified ? "✓ matched in retrieved text" : "· not text-matched"}
                          </p>
                        ) : null}
                        {finding.blockers.length ? (
                          <ul className="mt-3 space-y-1 text-xs leading-5 text-warn">
                            {finding.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
                          </ul>
                        ) : null}
                        {finding.currentnessNote ? (
                          <p className="mt-3 text-xs leading-5 text-parchment/55">Currentness: {finding.currentnessNote}</p>
                        ) : null}
                        {finding.contraryAuthority ? (
                          <p className="mt-2 text-xs leading-5 text-parchment/55">Contrary authority: {finding.contraryAuthority}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-warn/30 bg-warn/5 p-4 text-sm leading-6 text-parchment/75">
                    <AlertTriangle className="mr-2 inline h-4 w-4 text-warn" aria-hidden />
                    No legal proposition was promoted. The unresolved research steps below are the useful result.
                  </div>
                )}

                {result.sources.length ? (
                  <div className="border-t border-gold/15 pt-5">
                    <h4 className="flex items-center gap-2 font-serif text-xl text-parchment">
                      <ShieldCheck className="h-5 w-5 text-gold" aria-hidden /> Sources actually checked
                    </h4>
                    <div className="mt-3 space-y-2">
                      {result.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl border border-parchment/10 bg-forest-deep/20 p-3 text-sm hover:border-gold/35"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-parchment">{source.title || source.issuingBody}</p>
                              <p className="mt-1 text-xs text-parchment/50">
                                {source.authorityClass} · {source.jurisdiction} · {source.retrievalStatus}
                              </p>
                            </div>
                            <ExternalLink className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {result.books.length ? (
                  <div className="border-t border-gold/15 pt-5">
                    <h4 className="flex items-center gap-2 font-serif text-xl text-parchment">
                      <BookOpen className="h-5 w-5 text-gold" aria-hidden /> Law books & published authorities
                    </h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {result.books.map((book) => (
                        <article key={book.title} className="rounded-xl border border-parchment/10 bg-forest-deep/20 p-4">
                          <span className="rounded-full border border-violet-accent/30 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-violet-accent">
                            Secondary
                          </span>
                          <h5 className="mt-3 font-semibold text-parchment">{book.title}</h5>
                          <p className="mt-1 text-xs text-parchment/55">
                            {book.author} · {book.edition} · {book.year} · {book.publisher}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-parchment/60">{book.authorityNote}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 border-t border-gold/15 pt-5 md:grid-cols-2">
                  <ResultList title="Missing facts" items={result.missingFacts} icon={AlertTriangle} />
                  <ResultList title="Next research" items={result.nextResearch} icon={Search} />
                  <ResultList title="Procedure / deadlines" items={result.procedureAndDeadlines} icon={CheckCircle2} />
                  <ResultList title="Options to investigate" items={result.options} icon={Scale} />
                </div>

                <div className="rounded-2xl border border-violet-accent/25 bg-violet-accent/8 p-4">
                  <h4 className="flex items-center gap-2 font-semibold text-parchment">
                    <Fingerprint className="h-4 w-4 text-violet-accent" aria-hidden /> Continuity receipt
                  </h4>
                  <p className="mt-2 break-all font-mono text-[11px] text-parchment/65">{result.continuity.fingerprint}</p>
                  <p className="mt-2 text-xs text-parchment/55">
                    {result.continuity.authority} · {result.continuity.freshness}
                    {result.continuity.predecessor ? " · predecessor bound" : ""}
                  </p>
                  {result.continuity.staleReason ? (
                    <p className="mt-1 text-xs text-warn">{result.continuity.staleReason}</p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultList({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: typeof Search;
}) {
  return (
    <div className="rounded-2xl border border-parchment/10 bg-forest-deep/20 p-4">
      <h4 className="flex items-center gap-2 font-semibold text-parchment">
        <Icon className="h-4 w-4 text-gold" aria-hidden /> {title}
      </h4>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-parchment/70">
          {items.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-parchment/45">Nothing established yet.</p>
      )}
    </div>
  );
}
