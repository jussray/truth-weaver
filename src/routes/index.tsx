import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  BookOpen, Briefcase, CreditCard, FileSignature, FileText, Gavel, Globe2, HeartPulse, Home, Landmark,
  Plane, ShieldCheck, Users, UsersRound, Building2, ArrowRight, CheckCircle2, Rocket,
} from "lucide-react";

import heroImg from "@/assets/hero-sanctum.jpg";
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
          <img src={heroImg} alt="Law office at night with law books, laptop, justice mug, scales and gavel" width={1920} height={1088} className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--ink)_0%,color-mix(in_oklab,var(--ink)_92%,transparent)_30%,color-mix(in_oklab,var(--ink)_35%,transparent)_60%,transparent_100%)]" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-transparent to-ink/40" />
          <div className="warm-pulse pointer-events-none absolute right-[30%] top-[18%] -z-10 h-72 w-72 rounded-full bg-gold/25 blur-3xl" aria-hidden />

          <div className="relative mx-auto grid max-w-[96rem] gap-10 px-5 pb-14 pt-12 sm:px-6 lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pt-16">
            <div className="rise-in">
              <p className="text-[11px] font-semibold uppercase tracking-[0.6em] text-parchment/85 sm:text-xs">Turn knowledge into power</p>
              <h1 className="mt-5 font-serif text-5xl font-semibold leading-[0.98] tracking-[-0.01em] text-parchment sm:text-6xl xl:text-7xl">
                Understand the Law.
                <br />
                <span className="gold-foil">Change What’s Possible.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-parchment/85 sm:text-lg">
                Practical legal knowledge, professional tools, and real-world resources for individuals, families, creators, and businesses — anywhere in the world.
              </p>
              <ul className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  [BookOpen, "Accurate", "Legal Information"],
                  [ShieldCheck, "Practical", "Tools & Templates"],
                  [Globe2, "Global", "Coverage"],
                ].map(([Icon, a1, a2]) => {
                  const I = Icon as typeof BookOpen;
                  return (
                    <li key={a1 as string} className="flex items-center gap-3">
                      <I className="h-8 w-8 shrink-0 text-gold" aria-hidden />
                      <span className="text-sm leading-5 text-parchment/90">{a1 as string}<br />{a2 as string}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="/shop" className="foil-surface group inline-flex items-center justify-center gap-3 rounded-full px-8 py-3.5 text-base font-semibold text-ink shadow-[0_14px_40px_-10px_var(--gold)] transition hover:shadow-[0_18px_60px_-8px_var(--gold)]">
                  Shop Legal Tools <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden />
                </a>
                <a href="#legal-areas" className="inline-flex items-center justify-center rounded-full border border-gold/70 bg-ink/40 px-8 py-3.5 text-base font-semibold text-parchment backdrop-blur transition hover:bg-gold/10 hover:shadow-[0_0_30px_-8px_var(--gold)]">
                  Explore by Legal Area
                </a>
              </div>
              <p className="mt-7 font-script text-4xl text-gold-soft sm:text-5xl">Knowledge Protects. People Thrive.</p>
            </div>

            <div className="relative hidden lg:block" aria-hidden>
              <ul className="absolute right-40 top-0 space-y-2 font-serif text-sm uppercase tracking-[0.22em] text-gold">
                {["People", "Ideas", "Businesses", "Communities", "Worldwide"].map((w) => <li key={w}>{w}</li>)}
              </ul>
              <ul className="absolute -top-2 right-0 space-y-3 rounded-l-xl border-l border-violet-accent/60 bg-violet-accent/15 px-5 py-4 text-sm font-semibold uppercase tracking-[0.3em] text-violet-accent shadow-[0_0_50px_-10px_var(--violet-accent)] backdrop-blur-sm">
                {["Learn", "Apply", "Solve", "Build", "Belong"].map((w) => <li key={w}>{w}</li>)}
              </ul>
              <div className="absolute left-0 top-28 flex w-72 flex-col gap-1.5">
                {BOOKS.map((b, i) => (
                  <div key={b} className="rise-in flex items-center rounded-r-[4px] border-y border-r border-gold/30 bg-[linear-gradient(180deg,oklch(0.2_0.01_250),oklch(0.12_0.01_250))] shadow-[0_8px_18px_-8px_black]" style={{ animationDelay: `${0.15 + i * 0.08}s`, marginLeft: `${(i % 2) * 8}px` }}>
                    <span className="h-11 w-10 shrink-0 bg-[repeating-linear-gradient(180deg,var(--parchment)_0_2px,oklch(0.85_0.03_85)_2px_3px)]" />
                    <span className="gold-foil flex-1 py-2.5 text-center font-serif text-base font-semibold uppercase tracking-[0.12em]">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* LEGAL AREAS */}
        <section id="legal-areas" className="relative px-3 pb-8 sm:px-6">
          <h2 className="sr-only">Explore by legal area</h2>
          <div className="mx-auto max-w-[96rem] rounded-3xl border border-gold/15 bg-ink/80 p-3 backdrop-blur sm:p-4">
            <div data-legal-areas className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-11">
              {LEGAL_AREAS.map(([title, , Icon]) => (
                <article key={title} className="glow-card group flex flex-col items-center rounded-xl border border-gold/20 bg-[linear-gradient(180deg,oklch(0.2_0.012_250),oklch(0.14_0.01_250))] px-2 py-4 text-center">
                  <Icon className="h-10 w-10 text-gold drop-shadow-[0_0_10px_color-mix(in_oklab,var(--gold)_60%,transparent)] transition group-hover:scale-110" aria-hidden />
                  <h3 className="mt-3 flex min-h-[2.5rem] items-center text-sm leading-tight text-parchment">{title}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <a href={`/shop?area=${encodeURIComponent(title)}`} className="font-semibold text-gold-soft hover:text-gold">Shop →</a>
                    <a href="#decision-test" className="text-parchment/50 hover:text-parchment">Research</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PROOF BANNER */}
        <section id="about" className="border-t border-gold/15 bg-[linear-gradient(90deg,var(--forest-deep),var(--ink)_55%,color-mix(in_oklab,var(--violet-accent)_22%,var(--ink)))] px-5 py-6 sm:px-6">
          <div className="mx-auto flex max-w-[96rem] flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-5 sm:grid-cols-3 lg:divide-x lg:divide-gold/25">
              {[
                [CheckCircle2, "Curated & Verified Resources", "Backed by real legal sources"],
                [Rocket, "Instant Digital Access", "Delivered straight to you"],
                [Users, "Tools for Real People", "Individuals. Families. Creators. Businesses."],
              ].map(([Icon, t, d], i) => {
                const I = Icon as typeof Users;
                return (
                  <div key={t as string} className={`flex items-center gap-3 ${i ? "lg:pl-6" : ""}`}>
                    <I className="h-9 w-9 shrink-0 text-gold" aria-hidden />
                    <div><h3 className="text-sm font-semibold text-parchment">{t as string}</h3><p className="text-xs text-parchment/60">{d as string}</p></div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <h2 className="sr-only">Start Building a Fairer Tomorrow</h2>
              <a href="/shop" className="foil-surface group inline-flex items-center gap-3 rounded-full px-7 py-3.5 text-sm font-semibold text-ink shadow-[0_12px_36px_-10px_var(--gold)]">
                Start Building a Fairer Tomorrow <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
              </a>
            </div>
          </div>
          <p className="mx-auto mt-5 max-w-[96rem] text-xs leading-5 text-parchment/50">
            Sources are labelled by authority: primary law, secondary commentary, or discovery. AI and web results stay marked generated or unverified until backed by official text.{" "}
            <a href="/connectors" className="text-gold underline-offset-4 hover:underline">Source Center</a>
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
