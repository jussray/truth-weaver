import { pageHead } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AuthorityChip, IntegrationBadge } from "@/components/counsel/ui-bits";
import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { listSources } from "@/lib/counsel";

export const Route = createFileRoute("/sources")({
  head: () =>
    pageHead({ path: '/sources', title: 'Official Legal Sources We Check | Truth Weaver Counsel', description: 'The official law websites, courts and government sources Truth Weaver checks, which places are covered today, and where coverage is still limited.', breadcrumbs: [{ name: "Home", path: "/" }, { name: 'Sources', path: '/sources' }] }),
  component: SourcesPage,
});

function sourceRecord(value: boolean | null, yes: string, no: string) {
  if (value === true) return yes;
  if (value === false) return no;
  return "not recorded";
}

function SourcesPage() {
  const q = useQuery({ queryKey: ["sources"], queryFn: listSources });
  return (
    <CounselPage title="Source registry" eyebrow="Registered sources — not exhaustive coverage">
      <section data-testid="sources-intro" aria-labelledby="sources-intro-title" className="mb-8 max-w-3xl space-y-3 text-sm leading-6 text-parchment/75">
        <h2 id="sources-intro-title" className="font-serif text-2xl text-parchment">Where does Truth Weaver get its legal information?</h2>
        <p>
          When you research a situation, Truth Weaver first works out the place it happened. It then looks only on the
          official public websites registered for that place, such as legislatures, courts and government publishers,
          and opens the page to try to match the citation and check its date.
        </p>
        <p>
          Being listed here does not mean a place or subject is fully covered, or that the law is current. Each record
          below shows who publishes the source, whether it is marked official, and how to check it is up to date. Use
          "Open source site" to read the official text yourself, and confirm anything important with a qualified lawyer.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a href="/connectors#how-we-check-sources" className="text-gold underline-offset-4 hover:underline">How we check sources</a>
          <a href="/#legal-research" className="text-gold underline-offset-4 hover:underline">Start free legal research</a>
        </p>
      </section>
      {q.isLoading && <StateBox kind="loading">Loading sources…</StateBox>}
      {q.error && <StateBox kind="error">{(q.error as Error).message}</StateBox>}
      {q.data?.length === 0 && <StateBox kind="empty">No sources registered.</StateBox>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((s) => (
          <li key={s.id} className={tw.card}>
            <div className="flex flex-wrap gap-2">
              <AuthorityChip source={s} />
              <IntegrationBadge status={s.integration_status} />
            </div>
            <h2 className="mt-2 font-serif text-lg">{s.name}</h2>
            {s.issuing_body && <p className="mt-1 text-sm text-parchment/70">Issuing body: {s.issuing_body}</p>}
            {s.coverage_description && <p className="mt-2 text-sm text-parchment/70">{s.coverage_description}</p>}
            <dl className="mt-3 grid gap-1 border-t border-parchment/10 pt-3 text-xs text-parchment/60">
              <div>
                <dt className="inline font-semibold text-parchment/75">Official-source record: </dt>
                <dd className="inline">{sourceRecord(s.is_official, "marked official", "not marked official")}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-parchment/75">Authenticity record: </dt>
                <dd className="inline">{sourceRecord(s.is_authentic, "marked authentic", "not marked authentic")}</dd>
              </div>
              {s.authority_weight && (
                <div>
                  <dt className="inline font-semibold text-parchment/75">Authority context: </dt>
                  <dd className="inline">{s.authority_weight}</dd>
                </div>
              )}
            </dl>
            {s.currentness_strategy && (
              <p className="mt-3 text-xs leading-5 text-parchment/60">
                <span className="font-semibold text-parchment/75">Currentness guidance: </span>
                {s.currentness_strategy}
              </p>
            )}
            {s.base_url && (
              <a href={s.base_url} target="_blank" rel="noreferrer" className="mt-3 inline-block break-all text-xs text-gold">
                Open source site ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </CounselPage>
  );
}
