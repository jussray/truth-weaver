import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

export const Route = createFileRoute("/")({
  component: TruthWeaverModule,
  head: () => ({
    meta: [
      { title: "Truth Weaver | Founder Control Room" },
      {
        name: "description",
        content:
          "Truth Weaver is a Founder Control Room module for separating evidence from inference, stress-testing a decision, and producing one bounded next test.",
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

function TruthWeaverModule() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [copyState, setCopyState] = useState("Copy receipt");

  const hydrated = useHydrated();
  const formRef = useRef<HTMLFormElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Prefer values typed into the server-rendered DOM before hydration.
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
    <main className="min-h-screen bg-[#070912] text-[#f7f5ff]" data-fcr-module="truth-weaver">
      <header className="border-b border-white/10 bg-[#080b15]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
              FCR · Truth Weaver
            </p>
            <p className="mt-1 text-sm text-slate-400">Decision stress-test module</p>
          </div>
          <a
            href="https://foundercontrolroom.org"
            className="rounded-lg border border-violet-300/30 px-3 py-2 text-sm font-bold text-violet-100 hover:bg-violet-300/10"
          >
            Back to Founder Control Room
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              External tester loop
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
              Turn a decision into one test you can actually learn from.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Keep facts separate from guesses, attack the weak point, then define the smallest reversible test. This module does not merge, deploy, spend, publish, or grant authority.
            </p>
            <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm leading-6 text-emerald-100">
              <strong>Local-first:</strong> your draft stays in this browser. The completion receipt contains only what you type here and is marked non-authorizing.
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

            <button
              type="submit"
              data-generate-receipt
              disabled={!hydrated}
              aria-disabled={!hydrated}
              className="rounded-xl bg-gradient-to-r from-violet-300 via-fuchsia-200 to-cyan-300 px-5 py-3 font-black text-slate-950 disabled:cursor-wait"
            >
              Produce completion receipt
            </button>

            {receipt ? (
              <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5" data-completion-receipt>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Receipt produced</p>
                    <h2 className="mt-1 text-xl font-black">One bounded next test</h2>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">non-authorizing</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-200">{receipt.boundedTest}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-black/20 p-3"><span className="text-xs uppercase tracking-wider text-slate-500">Success</span><p className="mt-1 text-sm">{receipt.successCondition}</p></div>
                  <div className="rounded-xl bg-black/20 p-3"><span className="text-xs uppercase tracking-wider text-slate-500">Stop / rollback</span><p className="mt-1 text-sm">{receipt.stopCondition}</p></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={copyReceipt} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold hover:bg-white/5">{copyState}</button>
                  <button type="button" onClick={downloadReceipt} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold hover:bg-white/5">Download receipt</button>
                </div>
              </section>
            ) : null}
          </form>
        </div>
      </section>
    </main>
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
    <label className="block rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <span className="flex items-center gap-2 text-sm font-black">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-300/10 text-xs text-violet-200">{number}</span>
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
        className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
      />
    </label>
  );
}
