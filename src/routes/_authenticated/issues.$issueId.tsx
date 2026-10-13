import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { TruthBadge } from "@/components/counsel/ui-bits";
import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { getIssue, listFindings } from "@/lib/counsel";

export const Route = createFileRoute("/_authenticated/issues/$issueId")({
  head: () => ({
    meta: [
      { title: "Issue workspace — Truth Weaver Counsel" },
      { name: "description", content: "Your private legal issue workspace." },
      { property: "og:title", content: "Issue workspace — Truth Weaver Counsel" },
      { property: "og:description", content: "Findings, sources and authority labels for one issue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IssuePage,
});

function IssuePage() {
  const { issueId } = Route.useParams();
  const issue = useQuery({ queryKey: ["issue", issueId], queryFn: () => getIssue(issueId) });
  const findings = useQuery({ queryKey: ["findings", issueId], queryFn: () => listFindings(issueId) });
  const i = issue.data;
  return (
    <CounselPage title={i?.title ?? "Issue"} eyebrow="Issue workspace" back={{ to: "/dashboard", label: "Dashboard" }}>
      <WorkspaceNav />
      {issue.isLoading && <StateBox kind="loading">Loading issue…</StateBox>}
      {issue.error && <StateBox kind="error">{(issue.error as Error).message}</StateBox>}
      {issue.isSuccess && !i && <StateBox kind="error">Issue not found or you don't have access.</StateBox>}
      {i && (
        <div className="grid gap-4">
          <section className={tw.card}>
            <p className={tw.label}>Jurisdiction · dates</p>
            <p className="mt-1 text-sm">{i.jurisdiction_note || (i.jurisdiction_id ? "Registered jurisdiction" : "JURISDICTION UNKNOWN")} · event {i.event_date ?? "not set"} · law as of {i.as_of_date ?? "not set"}</p>
            {i.facts && <p className="mt-3 whitespace-pre-wrap text-sm text-parchment/80">{i.facts}</p>}
          </section>
          <section className={tw.card}>
            <h2 className="font-serif text-xl">Findings</h2>
            {findings.data?.length === 0 && <StateBox kind="empty">No findings yet. Nothing here is verified law until a primary source, citation and currentness check are recorded.</StateBox>}
            <ul className="mt-3 space-y-2">
              {findings.data?.map((f) => (
                <li key={f.id} className="flex flex-wrap items-start gap-2 text-sm"><TruthBadge state={f.truth_state} /> {f.proposition}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </CounselPage>
  );
}
