import { pageHead } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { listBooks } from "@/lib/counsel";

export const Route = createFileRoute("/legal-library")({
  head: () =>
    pageHead({ path: '/legal-library', title: 'Legal Library: Law Books & Treatises | Truth Weaver Counsel', description: 'Browse law books, treatises and guides that explain the law. Books help you understand and find law, but the official law itself always comes first.', breadcrumbs: [{ name: "Home", path: "/" }, { name: 'Legal Library', path: '/legal-library' }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const q = useQuery({ queryKey: ["books"], queryFn: listBooks });
  return (
    <CounselPage title="Legal library: law books and secondary sources" eyebrow="Secondary sources — cannot by themselves establish verified law">
      {q.isLoading && <StateBox kind="loading">Loading library…</StateBox>}
      {q.error && <StateBox kind="error">{(q.error as Error).message}</StateBox>}
      {q.data?.length === 0 && <StateBox kind="empty">No books registered yet.</StateBox>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((b) => {
          const catalogUrl = b.catalog_url && /^https?:\/\//i.test(b.catalog_url) ? b.catalog_url : null;
          return (
            <li key={b.id} className={tw.card}>
              <p className={tw.label}>{b.book_type}{b.year ? ` · ${b.year}` : ""}</p>
              <h2 className="mt-1 font-serif text-lg">{b.title}</h2>
              <p className="mt-1 text-sm text-parchment/70">{[b.author, b.edition, b.publisher].filter(Boolean).join(" · ")}</p>
              {b.topic && <p className="mt-2 text-sm text-parchment/70"><span className="font-semibold">Topic: </span>{b.topic}</p>}
              <dl className="mt-3 grid gap-2 border-t border-parchment/10 pt-3 text-xs leading-5 text-parchment/65">
                {b.secondary_role_note && (
                  <div>
                    <dt className="font-semibold text-parchment/80">Authority role</dt>
                    <dd>{b.secondary_role_note}</dd>
                  </div>
                )}
                {b.licensing_note && (
                  <div>
                    <dt className="font-semibold text-parchment/80">Text and access</dt>
                    <dd>{b.licensing_note}</dd>
                  </div>
                )}
              </dl>
              {catalogUrl && (
                <a href={catalogUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-gold">
                  Open catalog record ↗
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </CounselPage>
  );
}
