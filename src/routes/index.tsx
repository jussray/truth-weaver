import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  BookOpen, Briefcase, CreditCard, FileSignature, FileText, Gavel, Globe2, HeartPulse, Home, Landmark,
  Plane, Scale, ShieldCheck, Users, UsersRound, Zap, Building2,
} from "lucide-react";

import heroImg from "@/assets/hero-law-desk.jpg";
import { SiteChrome } from "@/components/storefront/site-chrome";

export const Route = createFileRoute("/")({
  component: TruthWeaverModule,
  head: () => ({
    meta: [
      { title: "Truth Weaver Counsel | Understand the Law. Change What’s Possible." },
      {
        name: "description",
        content:
          "Source-aware legal knowledge, guides, templates and tools for individuals, families, creators and businesses. Governing law is the authority.",
      },
      { property: "og:title", content: "Truth Weaver Counsel — Understand the Law" },
      { property: "og:description", content: "Source-aware legal knowledge and practical legal tools for real people, across every jurisdiction layer." },
    ],
  }),
});

type Draft = {
  decision: string;
  evidence: string;
  inference: string;
  challenge: string;
  boundedTest: string;
  successCondition: string;
  stopCondition: string;
};

type Receipt = Draft & {
  schema: "fcr.truth-weaver.external-test.v1";
  module: "truth-weaver";
  createdAt: string;
  authority: "non-authorizing";
};

const STORAGE_KEY = "fcr.truth-weaver.external-tester.v1";
const EMPTY_DRAFT: Draft = {
  decision: "",
  evidence: "",
  inference: "",
  challenge: "",
  boundedTest: "",
  successCondition: "",
  stopCondition: "",
};
const LEGAL_AREAS = [
  ["Housing & Real Estate", "Renting, ownership, eviction, local rules", Home],
  ["Credit & Debt", "Reports, disputes, collections, consumer rights", CreditCard],
  ["Family & Relationships", "Family responsibilities and agreements", UsersRound],
  ["Business & Entrepreneurship", "Formation, operations, compliance", Briefcase],
  ["Contracts & Agreements", "Terms, obligations, documents", FileSignature],
  ["Criminal Law", "Process, rights, court navigation", Gavel],
  ["Health & Disability", "Access, accommodations, benefits", HeartPulse],
  ["Immigration", "Status, filings, process navigation", Plane],
  ["Government & Civil Rights", "Public systems, rights, remedies", Landmark],
  ["Employment & Workplace", "Pay, protections, workplace rules", Building2],
  ["International Law", "Treaties, cross-border sources", Globe2],
] as const;

const BOOKS = ["Constitutions", "Statutes", "Case Law", "Regulations", "Local Codes", "International Law"] as const;

function TruthWeaverModule() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [copyState, setCopyState] = useState("Copy receipt");

  const hydrated = useHydrated();
  const formRef = useRef<HTMLFormElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const fields = Object.keys(EMPTY_DRAFT) as (keyof Draft)[];
    const fromDom = { ...EMPTY_DRAFT };
    const form = formRef.current;
    if (form) {
      const data = new FormData(form);
      for (const f of fields) fromDom[f] = String(data.get(f) ?? "");
    }
    if (fields.some((f) => fromDom[f].length > 0)) {
      setDraft(fromDom);
    } else {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const value = JSON.parse(saved) as Partial<Draft>;
          const next = { ...EMPTY_DRAFT };
          for (const f of fields) next[f] = value[f] ?? "";
          setDraft(next);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function generateReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitted: Draft = {
      decision: String(form.get("decision") ?? "").trim(),
      evidence: String(form.get("evidence") ?? "").trim(),
      inference: String(form.get("inference") ?? "").trim(),
      challenge: String(form.get("challenge") ?? "").trim(),
      boundedTest: String(form.get("boundedTest") ?? "").trim(),
      successCondition: String(form.get("successCondition") ?? "").trim(),
      stopCondition: String(form.get("stopCondition") ?? "").trim(),
    };

    if (Object.values(submitted).some((value) => value.length === 0)) return;

    setDraft(submitted);
    setReceipt({
      schema: "fcr.truth-weaver.external-test.v1",
      module: "truth-weaver",
      createdAt: new Date().toISOString(),
      ...submitted,
      authority: "non-authorizing",
    });
  }

  async function copyReceipt() {
    if (!receipt) return;
    await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    setCopyState("Copied");
    window.setTimeout(() => setCopyState("Copy receipt"), 1400);
  }

  function downloadReceipt() {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `truth-weaver-receipt-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div data-fcr-module="truth-weaver">
      <SiteChrome>
        {/* HERO */}
        <section id="top" className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(70rem_40rem_at_10%_0%,color-mix(in_oklab,var(--forest)_80%,transparent),transparent),radial-gradient(40rem_30rem_at_90%_20%,color-mix(in_oklab,var(--violet-accent)_18%,transparent),transparent)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-12 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pb-24 lg:pt-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.5em] text-gold">Turn knowledge into power</p>
              <h1 className="mt-5 font-serif text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-parchment sm:text-7xl lg:text-[5.4rem]">
                Understand the Law.
                <br />
                <span className="italic text-gold">Change What’s Possible.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-parchment/75">
                Clear, source-aware legal knowledge and practical tools for individuals, families, creators and
                businesses — so you can see what the law says, where it comes from, and what you can do next.
              </p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  [ShieldCheck, "Accurate legal information", "Official sources first, labelled by authority."],
                  [FileText, "Practical tools & templates", "Checklists, letters and research trails."],
                  [Globe2, "Global coverage", "Built for every jurisdiction layer."],
                ].map(([Icon, title, body]) => {
                  const I = Icon as typeof ShieldCheck;
                  return (
                    <li key={title as string} className="border-t border-gold/30 pt-3">
                      <I className="h-5 w-5 text-gold" aria-hidden />
                      <strong className="mt-2 block text-sm text-parchment">{title as string}</strong>
                      <span className="mt-1 block text-xs leading-5 text-parchment/55">{body as string}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="/shop" className="rounded-full bg-gold px-6 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-ink shadow-[0_18px_50px_-12px_var(--gold)] transition hover:bg-gold-soft">
                  Shop Legal Tools
                </a>
                <a href="#legal-areas" className="rounded-full border border-gold/50 px-6 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-gold-soft transition hover:bg-gold/10">
                  Explore by Legal Area
                </a>
              </div>
              <p className="mt-8 font-script text-3xl text-gold-soft sm:text-4xl">Knowledge Protects. People Thrive.</p>
            </div>

            <div className="relative" aria-label="Law office: source layers from constitutions to international law">
              <div className="relative overflow-hidden rounded-[2rem] border border-gold/25 shadow-[0_40px_120px_-30px_black]">
                <img src={heroImg} alt="Law desk at night with scales of justice, gavel, notebook and law books" width={1408} height={1056} className="h-[420px] w-full object-cover sm:h-[520px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-ink/40 to-transparent" />
              </div>
              {/* Book stack */}
              <div className="absolute -right-2 bottom-6 flex w-[58%] max-w-xs flex-col gap-1.5 sm:-right-4">
                {BOOKS.map((b, i) => (
                  <div
                    key={b}
                    className="flex items-center justify-between rounded-[3px] border border-gold/40 px-3 py-2 shadow-[0_6px_14px_-6px_black]"
                    style={{
                      marginLeft: `${(i % 3) * 10}px`,
                      background: i % 2 ? "linear-gradient(90deg, var(--forest-deep), var(--forest))" : "linear-gradient(90deg, oklch(0.25 0.06 30), oklch(0.32 0.07 35))",
                    }}
                  >
                    <span className="font-serif text-sm font-semibold uppercase tracking-[0.18em] text-gold-soft">{b}</span>
                    <span className="h-3 w-6 border-y border-gold/50" aria-hidden />
                  </div>
                ))}
              </div>
              {/* Laptop panel */}
              <div className="absolute left-4 top-6 max-w-[15rem] rounded-xl border border-parchment/15 bg-ink/80 p-4 backdrop-blur-md sm:left-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">Issue → Jurisdiction → Law → Action</p>
                <p className="mt-2 text-sm leading-5 text-parchment/85">See which law governs, where it comes from, and what to check next.</p>
                <p className="mt-3 flex items-center gap-2 text-[11px] text-violet-accent"><Scale className="h-3.5 w-3.5" aria-hidden /> Governing law is the authority</p>
              </div>
            </div>
          </div>
        </section>

        {/* LEGAL AREAS */}
        <section id="legal-areas" className="border-y border-gold/15 bg-forest-deep/60 py-14">
          <div className="mx-auto max-w-7xl px-5 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.4em] text-gold">Explore by legal area</p>
                <h2 className="mt-3 font-serif text-4xl font-semibold text-parchment sm:text-5xl">Start with the problem you actually have.</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-parchment/60">
                Areas organise research and tools. They don’t promise representation or outcomes, and coverage varies by jurisdiction.
              </p>
            </div>
            <div className="-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:-mx-6 sm:px-6" data-legal-areas>
              {LEGAL_AREAS.map(([title, body, Icon]) => (
                <article key={title} className="flex w-60 shrink-0 snap-start flex-col rounded-2xl border border-gold/20 bg-ink/70 p-5 transition hover:border-gold/60">
                  <Icon className="h-7 w-7 text-gold" aria-hidden />
                  <h3 className="mt-4 font-serif text-xl font-semibold leading-tight text-parchment">{title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-5 text-parchment/60">{body}</p>
                  <div className="mt-5 flex gap-2">
                    <a href={`/shop?area=${encodeURIComponent(title)}`} className="rounded-full bg-gold/90 px-3.5 py-1.5 text-xs font-bold text-ink hover:bg-gold">Shop</a>
                    <a href="#decision-test" className="rounded-full border border-parchment/20 px-3.5 py-1.5 text-xs text-parchment/80 hover:border-gold/50">Research</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* TRUST BAND */}
        <section id="about" className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              [BookOpen, "Curated & Verified Resources", "Official text first. Books and commentary are clearly labelled secondary — they explain the law, they never replace it."],
              [Zap, "Instant Digital Access", "Guides, templates and courses delivered straight to you through our store."],
              [Users, "Tools for Real People", "Plain-language checklists, letters and research trails you can actually use."],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof BookOpen;
              return (
                <div key={title as string} className="rounded-2xl border border-gold/20 bg-gradient-to-b from-forest-deep/70 to-ink p-6">
                  <I className="h-6 w-6 text-gold" aria-hidden />
                  <h3 className="mt-4 font-serif text-2xl font-semibold text-parchment">{title as string}</h3>
                  <p className="mt-2 text-sm leading-6 text-parchment/65">{body as string}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-3xl border border-gold/30 bg-[linear-gradient(110deg,var(--forest-deep),var(--ink)_60%,color-mix(in_oklab,var(--violet-accent)_25%,var(--ink)))] p-8 sm:p-10 md:flex-row md:items-center">
            <div>
              <h2 className="font-serif text-3xl font-semibold text-parchment sm:text-4xl">Start Building a Fairer Tomorrow</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-parchment/70">Pick your legal area, check the source, and leave with one clear next step.</p>
            </div>
            <a href="/shop" className="shrink-0 rounded-full bg-gold px-7 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-ink hover:bg-gold-soft">Shop Legal Tools</a>
          </div>
          <p className="mt-6 text-xs leading-5 text-parchment/50">
            Sources are labelled by authority: primary law, secondary commentary, or discovery. AI and web results are marked generated or unverified until backed by official text.{" "}
            <a href="/connectors" className="text-gold underline-offset-4 hover:underline">See the Source Center</a>.
          </p>
        </section>

        {/* DECISION TEST */}
        <section id="decision-test" className="border-t border-gold/15 bg-forest-deep/40 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-gold">Free decision test</p>
                <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.02] text-parchment sm:text-5xl">
                  Turn a decision into one test you can actually learn from.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-parchment/70">
                  Keep facts separate from guesses, attack the weak point, then define the smallest reversible test. The receipt proves only what you entered and what this browser produced.
                </p>
                <div className="mt-6 rounded-2xl border border-ok/25 bg-ok/10 p-4 text-sm leading-6 text-parchment/85">
                  <strong>Local-first:</strong> your draft stays in this browser. The completion receipt contains only what you type here and remains non-authorizing.
                </div>
                <div className="mt-4 rounded-2xl border border-gold/25 bg-gold/5 p-4 text-sm leading-6 text-parchment/80">
                  <strong>Not legal representation:</strong> use this to structure research and decisions. For legal advice about your situation, consult a qualified lawyer in the relevant jurisdiction.
                </div>
              </div>

              <form ref={formRef} method="post" action="" className="grid gap-4" data-external-tester-loop onSubmit={generateReceipt}>
                <Field field="decision" number="1" label="Decision or hypothesis" value={draft.decision} onChange={updateDraft} placeholder="What are you considering doing?" />
                <Field field="evidence" number="2" label="Verified evidence" value={draft.evidence} onChange={updateDraft} placeholder="What do you actually know, observe, or have a receipt for?" />
                <Field field="inference" number="3" label="Inference" value={draft.inference} onChange={updateDraft} placeholder="What are you assuming or interpreting?" />
                <Field field="challenge" number="4" label="Red-team challenge" value={draft.challenge} onChange={updateDraft} placeholder="What would make this idea fail or prove the reasoning weak?" />
                <Field field="boundedTest" number="5" label="Smallest reversible test" value={draft.boundedTest} onChange={updateDraft} placeholder="What is the smallest action that can produce useful evidence?" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field field="successCondition" number="6" label="Success condition" value={draft.successCondition} onChange={updateDraft} placeholder="What result counts as a real signal?" />
                  <Field field="stopCondition" number="7" label="Stop condition" value={draft.stopCondition} onChange={updateDraft} placeholder="What result means stop, revise, or roll back?" />
                </div>
                <button type="submit" data-generate-receipt disabled={!hydrated} aria-disabled={!hydrated} className="rounded-xl bg-gold px-5 py-3 font-bold text-ink transition hover:bg-gold-soft disabled:cursor-wait disabled:opacity-60">
                  Produce completion receipt
                </button>
                {receipt ? (
                  <section className="rounded-2xl border border-gold/30 bg-gold/5 p-5" data-completion-receipt>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Receipt produced</p>
                        <h3 className="mt-1 font-serif text-2xl text-parchment">One bounded next test</h3>
                      </div>
                      <span className="rounded-full border border-parchment/15 px-3 py-1 text-xs text-parchment/70">non-authorizing</span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-parchment/90">{receipt.boundedTest}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-ink/40 p-3"><span className="text-xs uppercase tracking-wider text-parchment/50">Success</span><p className="mt-1 text-sm">{receipt.successCondition}</p></div>
                      <div className="rounded-xl bg-ink/40 p-3"><span className="text-xs uppercase tracking-wider text-parchment/50">Stop / rollback</span><p className="mt-1 text-sm">{receipt.stopCondition}</p></div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button type="button" onClick={copyReceipt} className="rounded-lg border border-parchment/15 px-3 py-2 text-sm font-bold hover:bg-parchment/5">{copyState}</button>
                      <button type="button" onClick={downloadReceipt} className="rounded-lg border border-parchment/15 px-3 py-2 text-sm font-bold hover:bg-parchment/5">Download receipt</button>
                    </div>
                  </section>
                ) : null}
              </form>
            </div>
          </div>
        </section>
      </SiteChrome>
    </div>
  );
}

function Field({
  field,
  number,
  label,
  value,
  onChange,
  placeholder,
}: {
  field: keyof Draft;
  number: string;
  label: string;
  value: string;
  onChange: (field: keyof Draft, value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block rounded-2xl border border-gold/20 bg-ink/70 p-4">
      <span className="flex items-center gap-2 text-sm font-bold text-parchment">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold/15 text-xs text-gold">{number}</span>
        {label}
      </span>
      <textarea
        name={field}
        data-field={field}
        required
        value={value}
        onInput={(event) => onChange(field, event.currentTarget.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-3 w-full resize-y rounded-xl border border-parchment/10 bg-ink/50 px-3 py-3 text-sm text-parchment outline-none placeholder:text-parchment/35 focus:border-gold/50"
      />
    </label>
  );
}
