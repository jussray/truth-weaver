import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

export const Route = createFileRoute("/")({
  component: TruthWeaverModule,
  head: () => ({
    meta: [
      { title: "Truth Weaver Counsel | Founder Control Room" },
      {
        name: "description",
        content:
          "Truth Weaver is an evidence-first Founder Control Room module for legal knowledge navigation, decision stress-testing, and bounded next-step planning.",
      },
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
  ["Housing & Real Estate", "Home, renting, ownership, local rules"],
  ["Credit & Debt", "Reports, disputes, collections, consumer rights"],
  ["Family & Relationships", "Family responsibilities and agreements"],
  ["Business & Entrepreneurship", "Formation, operations, contracts"],
  ["Contracts & Agreements", "Terms, obligations, documents"],
  ["Criminal Law", "Process, rights, court-system navigation"],
  ["Health & Disability", "Access, accommodations, benefits"],
  ["Immigration", "Status, filings, process navigation"],
  ["Government & Civil Rights", "Public systems, rights, remedies"],
  ["Employment & Workplace", "Workplace rules, pay, protections"],
  ["International Law", "Cross-border sources and jurisdiction"],
] as const;

const SOURCE_LAYERS = [
  "Constitutions",
  "Statutes",
  "Case law",
  "Regulations",
  "Local codes",
  "International sources",
] as const;

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
    <main
      className="min-h-screen overflow-x-hidden bg-[#06070d] text-[#f8f3ea] selection:bg-[#b58b4b]/30"
      data-fcr-module="truth-weaver"
    >
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_6%,rgba(86,38,145,0.22),transparent_30rem),radial-gradient(circle_at_88%_12%,rgba(199,145,62,0.13),transparent_32rem),linear-gradient(160deg,#05060a_0%,#080b15_48%,#05060b_100%)]" />

      <header className="sticky top-0 z-40 border-b border-[#b68a4a]/15 bg-[#070912]/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <a href="#top" className="group flex items-center gap-3 no-underline">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-[#d4ad6a]/40 bg-[#17100a] text-xl text-[#e1bd7a] shadow-[0_0_34px_rgba(200,151,76,0.16)]">
              ⚖
            </span>
            <span>
              <span className="block font-serif text-xl tracking-[0.12em] text-[#f7f0e5]">TRUTH WEAVER</span>
              <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-[#d1a762]">Counsel · FCR Module</span>
            </span>
          </a>

          <nav className="hidden items-center gap-5 text-sm text-[#c9c0b4] lg:flex" aria-label="Truth Weaver navigation">
            <a href="#legal-areas" className="hover:text-[#e9c782]">Legal Areas</a>
            <a href="#sources" className="hover:text-[#e9c782]">Sources</a>
            <a href="#architecture" className="hover:text-[#e9c782]">How It Works</a>
            <a href="#decision-test" className="hover:text-[#e9c782]">Decision Test</a>
          </nav>

          <a
            href="https://foundercontrolroom.org"
            className="rounded-full border border-[#c7974e]/35 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#ead6af] transition hover:border-[#e1b866]/70 hover:bg-[#c7974e]/10"
          >
            Founder Control Room ↗
          </a>
        </div>
      </header>

      <section id="top" className="relative mx-auto max-w-7xl px-5 pb-10 pt-16 sm:px-6 lg:pb-20 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.5em] text-[#d7ad69]">Turn knowledge into power</p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.95] tracking-[-0.04em] text-[#fffaf3] sm:text-7xl lg:text-[5.6rem]">
              Understand the law.<br />
              <span className="text-[#e5bc75]">Change what’s possible.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#c5bdaf]">
              Evidence-first legal knowledge navigation, source-aware tools, and decision support for real-world questions. Truth Weaver is educational decision infrastructure, not a law firm and not a substitute for a licensed attorney.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#legal-areas" className="rounded-full bg-[#d7ab62] px-5 py-3 text-sm font-black text-[#151009] shadow-[0_14px_45px_rgba(193,139,67,0.18)]">
                Explore legal areas →
              </a>
              <a href="#decision-test" className="rounded-full border border-[#d3a75f]/35 px-5 py-3 text-sm font-black text-[#f1d8ad] hover:bg-[#d3a75f]/10">
                Stress-test a decision
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Source-aware", "Separate legal source layers from interpretation."],
                ["02", "Evidence-first", "Keep facts, inference, and uncertainty visibly distinct."],
                ["03", "Bounded action", "Finish with a reversible next step and stop condition."],
              ].map(([number, title, body]) => (
                <div key={number} className="border-t border-[#d4a968]/30 pt-4">
                  <span className="text-[10px] font-black tracking-[0.28em] text-[#a77c45]">{number}</span>
                  <strong className="mt-1 block text-sm text-[#f2e8d9]">{title}</strong>
                  <span className="mt-1 block text-xs leading-5 text-[#948d83]">{body}</span>
                </div>
              ))}
            </div>
          </div>

          <div id="sources" className="relative rounded-[2rem] border border-[#b88d4e]/25 bg-[#0b0d14]/90 p-5 shadow-[0_35px_120px_rgba(0,0,0,0.52)] sm:p-7">
            <div className="absolute inset-0 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_70%_15%,rgba(106,52,151,0.16),transparent_40%)]" />
            <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#b98d4f]">Source map</p>
                <h2 className="mt-2 font-serif text-3xl text-[#fff9f0]">Know what kind of authority you are reading.</h2>
              </div>
              <span className="rounded-full border border-[#8f6e3f]/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#c9a86e]">Evidence layer</span>
            </div>

            <div className="mt-6 space-y-3">
              {SOURCE_LAYERS.map((source, index) => (
                <div
                  key={source}
                  className="group flex items-center justify-between rounded-xl border border-[#a77f46]/20 bg-[linear-gradient(100deg,rgba(56,38,23,0.85),rgba(16,18,28,0.92))] px-4 py-3 shadow-[inset_0_1px_rgba(255,255,255,0.03)]"
                >
                  <span className="font-serif text-lg tracking-[0.08em] text-[#d8b275]">{source}</span>
                  <span className="text-xs text-[#7f7567]">0{index + 1}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#8056aa]/25 bg-[#6b3e8a]/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#b88ae4]">Truth boundary</p>
              <p className="mt-2 text-sm leading-6 text-[#c8bdcb]">
                A source layer can support a claim, but it does not automatically decide jurisdiction, current applicability, or your specific legal outcome. Those remain separate questions.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="legal-areas" className="border-y border-white/5 bg-[#090b11]/80 py-14">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-[#b88a4e]">Explore by legal area</p>
              <h2 className="mt-3 max-w-3xl font-serif text-4xl tracking-[-0.03em] text-[#fff9f0] sm:text-5xl">Start with the problem you actually have.</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-[#9f978c]">
              These lanes organize research and decision work. They are navigation categories, not promises of representation, legal results, products, or pricing.
            </p>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {LEGAL_AREAS.map(([title, body], index) => (
              <a
                key={title}
                href="#decision-test"
                className="group min-h-36 rounded-2xl border border-white/8 bg-[#10131c]/80 p-5 transition hover:-translate-y-0.5 hover:border-[#d1a65d]/40 hover:bg-[#15151a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1a65d] motion-reduce:transform-none"
              >
                <span className="text-[10px] font-black tracking-[0.24em] text-[#80623a]">{String(index + 1).padStart(2, "0")}</span>
                <strong className="mt-7 block font-serif text-xl text-[#f7ead7]">{title}</strong>
                <span className="mt-2 block text-sm leading-5 text-[#918a80]">{body}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="architecture" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:py-24">
        <div className="mb-9 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.4em] text-[#a67c45]">One system · separate authority</p>
          <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em] text-[#fff9f0] sm:text-5xl">Truth Weaver → FCR → Commerce</h2>
          <p className="mt-4 text-base leading-7 text-[#aaa197]">
            The approved system map becomes a real product boundary here: knowledge and decisions flow forward, while authority stays explicit and proof does not magically turn into permission.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          <SystemCard
            eyebrow="Evidence · knowledge · action"
            title="Truth Weaver"
            body="Organize source layers, separate evidence from inference, attack weak reasoning, and produce a bounded next test."
            bullets={["Legal knowledge lanes", "Source-aware reasoning", "Decision receipts"]}
          />
          <FlowArrow />
          <SystemCard
            eyebrow="Authority · verification · continuity"
            title="FCR Control Plane"
            body="Owns permissions, project truth, evidence, verification gates, continuity, and founder decisions across connected systems."
            bullets={["Authority checks", "Proof receipts", "Project continuity"]}
          />
          <FlowArrow />
          <SystemCard
            eyebrow="Publish · payment · delivery"
            title="Commerce Surface"
            body="A separate storefront or payment surface can publish approved products and collect money only after its own authorization path is satisfied."
            bullets={["Separate publish gate", "Separate payment proof", "No implied Shopify state"]}
          />
        </div>

        <p className="mt-5 rounded-2xl border border-[#8a6840]/25 bg-[#8a6840]/7 p-4 text-sm leading-6 text-[#c5b9a8]">
          <strong className="text-[#e2c28d]">Authority ceiling:</strong> nothing on this page can merge code, deploy software, publish content, spend money, create legal representation, or mutate an external provider merely because a receipt exists.
        </p>
      </section>

      <section id="decision-test" className="border-t border-white/5 bg-[#080a10]/90 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#b78c50]">Decision test · external tester loop</p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.02] tracking-[-0.035em] text-[#fffaf3] sm:text-5xl">
                Turn a decision into one test you can actually learn from.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#b4aca1]">
                Keep facts separate from guesses, attack the weak point, then define the smallest reversible test. The receipt proves only what you entered and what this browser produced.
              </p>
              <div className="mt-6 rounded-2xl border border-[#5f8a6c]/25 bg-[#3f7652]/10 p-4 text-sm leading-6 text-[#c7dfcf]">
                <strong>Local-first:</strong> your draft stays in this browser. The completion receipt contains only what you type here and remains non-authorizing.
              </div>
              <div className="mt-4 rounded-2xl border border-[#9e7440]/25 bg-[#9e7440]/8 p-4 text-sm leading-6 text-[#d0c1ac]">
                <strong>Not legal representation:</strong> use this to structure research and decisions. For legal advice about your situation, consult a qualified lawyer in the relevant jurisdiction.
              </div>
            </div>

            <form
              ref={formRef}
              method="post"
              action=""
              className="grid gap-4"
              data-external-tester-loop
              onSubmit={generateReceipt}
            >
              <Field field="decision" number="1" label="Decision or hypothesis" value={draft.decision} onChange={updateDraft} placeholder="What are you considering doing?" />
              <Field field="evidence" number="2" label="Verified evidence" value={draft.evidence} onChange={updateDraft} placeholder="What do you actually know, observe, or have a receipt for?" />
              <Field field="inference" number="3" label="Inference" value={draft.inference} onChange={updateDraft} placeholder="What are you assuming or interpreting?" />
              <Field field="challenge" number="4" label="Red-team challenge" value={draft.challenge} onChange={updateDraft} placeholder="What would make this idea fail or prove the reasoning weak?" />
              <Field field="boundedTest" number="5" label="Smallest reversible test" value={draft.boundedTest} onChange={updateDraft} placeholder="What is the smallest action that can produce useful evidence?" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field field="successCondition" number="6" label="Success condition" value={draft.successCondition} onChange={updateDraft} placeholder="What result counts as a real signal?" />
                <Field field="stopCondition" number="7" label="Stop condition" value={draft.stopCondition} onChange={updateDraft} placeholder="What result means stop, revise, or roll back?" />
              </div>

              <button
                type="submit"
                data-generate-receipt
                disabled={!hydrated}
                aria-disabled={!hydrated}
                className="rounded-xl border border-[#e0b96e]/25 bg-[linear-gradient(100deg,#e0b96e,#c8954c)] px-5 py-3 font-black text-[#171008] shadow-[0_18px_50px_rgba(189,135,65,0.15)] disabled:cursor-wait disabled:opacity-60"
              >
                Produce completion receipt
              </button>

              {receipt ? (
                <section className="rounded-2xl border border-[#c79a57]/25 bg-[#c79a57]/7 p-5" data-completion-receipt>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d8b477]">Receipt produced</p>
                      <h3 className="mt-1 font-serif text-2xl text-[#fff7eb]">One bounded next test</h3>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#c7b9a9]">non-authorizing</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#e0d7ca]">{receipt.boundedTest}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-black/20 p-3"><span className="text-xs uppercase tracking-wider text-[#80786f]">Success</span><p className="mt-1 text-sm">{receipt.successCondition}</p></div>
                    <div className="rounded-xl bg-black/20 p-3"><span className="text-xs uppercase tracking-wider text-[#80786f]">Stop / rollback</span><p className="mt-1 text-sm">{receipt.stopCondition}</p></div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" onClick={copyReceipt} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold hover:bg-white/5">{copyState}</button>
                    <button type="button" onClick={downloadReceipt} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold hover:bg-white/5">Download receipt</button>
                  </div>
                </section>
              ) : null}
            </form>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#b88a4e]/15 bg-[#06070c] px-5 py-8 text-center sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-[#7c6b55]">Knowledge empowers people · evidence disciplines decisions · authority stays explicit</p>
      </footer>
    </main>
  );
}

function SystemCard({
  eyebrow,
  title,
  body,
  bullets,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: readonly string[];
}) {
  return (
    <article className="rounded-2xl border border-[#c09250]/20 bg-[#0d1018]/90 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.25)]">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9e7745]">{eyebrow}</p>
      <h3 className="mt-3 font-serif text-2xl text-[#f8ecdb]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#9d958b]">{body}</p>
      <ul className="mt-5 space-y-2 text-sm text-[#c3b9ab]">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2"><span className="text-[#c39450]">✓</span><span>{bullet}</span></li>
        ))}
      </ul>
    </article>
  );
}

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center text-2xl text-[#9b7645] lg:flex" aria-hidden="true">→</div>
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
    <label className="block rounded-2xl border border-[#a37a45]/20 bg-[#10131b]/85 p-4 shadow-[inset_0_1px_rgba(255,255,255,0.02)]">
      <span className="flex items-center gap-2 text-sm font-black text-[#efe1cc]">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#c08f4a]/12 text-xs text-[#dfb873]">{number}</span>
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
        className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-[#6f6961] focus:border-[#d4aa66]/45 focus:ring-2 focus:ring-[#d4aa66]/10"
      />
    </label>
  );
}
