import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { listBooks } from "@/lib/counsel";

export const Route = createFileRoute("/legal-library")({
  head: () => ({
    meta: [
      { title: "Legal library — Truth Weaver Counsel" },
      { name: "description", content: "Registered secondary legal books and treatises." },
      { property: "og:title", content: "Legal library — Truth Weaver Counsel" },
      { property: "og:description", content: "Books explain and help discover law; they are secondary sources." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const q = useQuery({ queryKey: ["books"], queryFn: listBooks });
  return (
    <CounselPage title="Legal library" eyebrow="Secondary sources — cannot by themselves establish verified law">
      {q.isLoading && <StateBox kind="loading">Loading library…</StateBox>}
      {q.error && <StateBox kind="error">{(q.error as Error).message}</StateBox>}
      {q.data?.length === 0 && <StateBox kind="empty">No books registered yet.</StateBox>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((b) => (
          <li key={b.id} className={tw.card}>
            <p className={tw.label}>{b.book_type}{b.year ? ` · ${b.year}` : ""}</p>
            <h2 className="mt-1 font-serif text-lg">{b.title}</h2>
            <p className="text-sm text-parchment/70">{[b.author, b.edition, b.publisher].filter(Boolean).join(" · ")}</p>
          </li>
        ))}
      </ul>
    </CounselPage>
  );
}
