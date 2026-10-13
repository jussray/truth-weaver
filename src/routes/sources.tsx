import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AuthorityChip, IntegrationBadge } from "@/components/counsel/ui-bits";
import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { listSources } from "@/lib/counsel";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Source registry — Truth Weaver Counsel" },
      { name: "description", content: "Registered legal source families and their integration status." },
      { property: "og:title", content: "Source registry — Truth Weaver Counsel" },
      { property: "og:description", content: "Registered source families, not exhaustive coverage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SourcesPage,
});

function SourcesPage() {
  const q = useQuery({ queryKey: ["sources"], queryFn: listSources });
  return (
    <CounselPage title="Source registry" eyebrow="Registered sources — not exhaustive coverage">
      {q.isLoading && <StateBox kind="loading">Loading sources…</StateBox>}
      {q.error && <StateBox kind="error">{(q.error as Error).message}</StateBox>}
      {q.data?.length === 0 && <StateBox kind="empty">No sources registered.</StateBox>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((s) => (
          <li key={s.id} className={tw.card}>
            <div className="flex flex-wrap gap-2"><AuthorityChip source={s} /><IntegrationBadge status={s.integration_status} /></div>
            <h2 className="mt-2 font-serif text-lg">{s.name}</h2>
            {s.coverage_description && <p className="mt-1 text-sm text-parchment/70">{s.coverage_description}</p>}
            {s.base_url && <a href={s.base_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-gold">{s.base_url}</a>}
          </li>
        ))}
      </ul>
    </CounselPage>
  );
}
