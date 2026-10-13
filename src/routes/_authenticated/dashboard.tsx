import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { listIssues } from "@/lib/counsel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Truth Weaver Counsel" },
      { name: "description", content: "Your saved legal issues and research history." },
      { property: "og:title", content: "Dashboard — Truth Weaver Counsel" },
      { property: "og:description", content: "Your private legal research workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const q = useQuery({ queryKey: ["issues"], queryFn: listIssues });
  return (
    <CounselPage
      title="Your legal issues"
      eyebrow="Research workspace"
      actions={<Link to="/issues/new" className={tw.btn}>New issue</Link>}
    >
      <WorkspaceNav />
      {q.isLoading && <StateBox kind="loading">Loading your issues…</StateBox>}
      {q.error && (
        <StateBox kind="error">
          Could not load issues: {(q.error as Error).message}{" "}
          <button className="underline" onClick={() => q.refetch()}>Retry</button>
        </StateBox>
      )}
      {q.data && q.data.length === 0 && (
        <StateBox kind="empty">No issues yet. Start one with “New issue”.</StateBox>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((i) => (
          <li key={i.id}>
            <Link to="/issues/$issueId" params={{ issueId: i.id }} className={`${tw.card} block hover:border-gold/50`}>
              <p className={tw.label}>{i.issue_area ?? "Unclassified"} · {i.status}</p>
              <h2 className="mt-1 font-serif text-xl">{i.title}</h2>
              <p className="mt-1 text-xs text-parchment/60">
                {i.jurisdiction_note || "Jurisdiction not set"} · as of {i.as_of_date ?? "not set"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </CounselPage>
  );
}
