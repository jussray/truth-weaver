import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { LEGAL_AREAS } from "@/domain/law";
import { createIssue, listJurisdictions } from "@/lib/counsel";

export const Route = createFileRoute("/_authenticated/issues/new")({
  head: () => ({
    meta: [
      { title: "New legal issue — Truth Weaver Counsel" },
      { name: "description", content: "Describe a legal issue with its facts, jurisdiction and relevant date." },
      { property: "og:title", content: "New legal issue — Truth Weaver Counsel" },
      { property: "og:description", content: "Start a jurisdiction-aware legal research issue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewIssue,
});

function NewIssue() {
  const navigate = useNavigate();
  const jur = useQuery({ queryKey: ["jurisdictions"], queryFn: listJurisdictions });
  const [f, setF] = useState({
    title: "", description: "", facts: "", jurisdiction_id: "", jurisdiction_note: "",
    event_date: "", as_of_date: new Date().toISOString().slice(0, 10), issue_area: "", parties: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const row = await createIssue({
        title: f.title.trim(),
        description: f.description || null,
        facts: f.facts || null,
        jurisdiction_id: f.jurisdiction_id || null,
        jurisdiction_note: f.jurisdiction_note || null,
        event_date: f.event_date || null,
        as_of_date: f.as_of_date || null,
        issue_area: f.issue_area || null,
        parties: f.parties || null,
      });
      navigate({ to: "/issues/$issueId", params: { issueId: row.id } });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <CounselPage title="New legal issue" eyebrow="Intake" back={{ to: "/dashboard", label: "Dashboard" }}>
      <WorkspaceNav />
      <form onSubmit={submit} className={`${tw.card} grid gap-4 sm:grid-cols-2`}>
        <label className="space-y-1 sm:col-span-2">
          <span className={tw.label}>Issue / goal *</span>
          <input name="title" className={tw.input} required maxLength={200} value={f.title} onChange={set("title")} placeholder="e.g. Landlord kept my security deposit" />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={tw.label}>Facts</span>
          <textarea name="facts" className={tw.input} rows={4} maxLength={5000} value={f.facts} onChange={set("facts")} />
        </label>
        <label className="space-y-1">
          <span className={tw.label}>Registered jurisdiction</span>
          <select name="jurisdiction_id" className={tw.input} value={f.jurisdiction_id} onChange={set("jurisdiction_id")}>
            <option value="">Not resolved yet</option>
            {jur.data?.map((j) => <option key={j.id} value={j.id}>{j.name} ({j.layer})</option>)}
          </select>
          {jur.error && <span className="text-xs text-red-300">Could not load jurisdictions.</span>}
        </label>
        <label className="space-y-1">
          <span className={tw.label}>Place (free text)</span>
          <input name="jurisdiction_note" className={tw.input} maxLength={200} value={f.jurisdiction_note} onChange={set("jurisdiction_note")} placeholder="City, county, state, country" />
        </label>
        <label className="space-y-1">
          <span className={tw.label}>Event date</span>
          <input name="event_date" type="date" className={tw.input} value={f.event_date} onChange={set("event_date")} />
        </label>
        <label className="space-y-1">
          <span className={tw.label}>Law as of</span>
          <input name="as_of_date" type="date" className={tw.input} value={f.as_of_date} onChange={set("as_of_date")} />
        </label>
        <label className="space-y-1">
          <span className={tw.label}>Legal area</span>
          <select name="issue_area" className={tw.input} value={f.issue_area} onChange={set("issue_area")}>
            <option value="">Unclassified</option>
            {LEGAL_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className={tw.label}>Parties</span>
          <input name="parties" className={tw.input} maxLength={300} value={f.parties} onChange={set("parties")} />
        </label>
        {error && <div className="sm:col-span-2"><StateBox kind="error">{error}</StateBox></div>}
        <div className="sm:col-span-2">
          <button className={tw.btn} disabled={busy} type="submit">{busy ? "Saving…" : "Create issue"}</button>
        </div>
      </form>
    </CounselPage>
  );
}
