import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  BookOpen, Briefcase, CreditCard, FileSignature, FileText, Gavel, Globe2, HeartPulse, Home, Landmark,
  Plane, ShieldCheck, Users, UsersRound, Building2, ArrowRight, CheckCircle2, Rocket,
  Bookmark, BookmarkCheck, Share2, Check,
} from "lucide-react";

import heroImg from "@/assets/hero-sanctum.jpg";
import { SiteChrome } from "@/components/storefront/site-chrome";
import { LegalNavigator } from "@/components/legal-navigator";

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


// Jurisprudence Cross-Reference Knowledge Base
export interface Passage {
  id: string;
  volume: typeof BOOKS[number];
  title: string;
  citation: string;
  excerpt: string;
  tags: string[];
  crossReferences: Array<{
    targetId: string;
    targetVolume: typeof BOOKS[number];
    label: string;
    citation: string;
  }>;
}

export const JURISPRUDENCE_PASSAGES: Passage[] = [
  {
    id: "cite-const-commerce",
    volume: "Constitutions",
    title: "Interstate Commerce Clause & Authority",
    citation: "U.S. Const. art. I, § 8, cl. 3",
    excerpt: "The Congress shall have Power... To regulate Commerce with foreign Nations, and among the several States, and with the Indian Tribes.",
    tags: ["commerce", "federal power", "jurisdiction"],
    crossReferences: [
      { targetId: "cite-stat-sherman", targetVolume: "Statutes", label: "Statutory Execution", citation: "15 U.S.C. § 1 (Sherman Act)" },
      { targetId: "cite-case-gibbons", targetVolume: "Case Law", label: "Foundational Interpretation", citation: "Gibbons v. Ogden, 22 U.S. 1" },
      { targetId: "cite-reg-trade", targetVolume: "Regulations", label: "Administrative Rules", citation: "16 C.F.R. § 240.1" }
    ]
  },
  {
    id: "cite-const-dueprocess",
    volume: "Constitutions",
    title: "Due Process & Fundamental Fairness",
    citation: "U.S. Const. amend. XIV, § 1",
    excerpt: "No State shall make or enforce any law which shall abridge the privileges or immunities of citizens... nor shall any State deprive any person of life, liberty, or property, without due process of law.",
    tags: ["due process", "rights", "procedural justice"],
    crossReferences: [
      { targetId: "cite-stat-civilrights", targetVolume: "Statutes", label: "Civil Remedy", citation: "42 U.S.C. § 1983" },
      { targetId: "cite-case-mathews", targetVolume: "Case Law", label: "Balancing Standard", citation: "Mathews v. Eldridge, 424 U.S. 319" },
      { targetId: "cite-intl-udhr", targetVolume: "International Law", label: "Universal Parallel", citation: "UDHR Article 10" }
    ]
  },
  {
    id: "cite-stat-sherman",
    volume: "Statutes",
    title: "Antitrust & Market Monopolization Prohibition",
    citation: "15 U.S.C. § 1–2",
    excerpt: "Every contract, combination in the form of trust or otherwise, or conspiracy, in restraint of trade or commerce among the several States... is declared to be illegal.",
    tags: ["antitrust", "markets", "fair competition"],
    crossReferences: [
      { targetId: "cite-const-commerce", targetVolume: "Constitutions", label: "Constitutional Source", citation: "U.S. Const. art. I, § 8, cl. 3" },
      { targetId: "cite-reg-ftc", targetVolume: "Regulations", label: "Enforcement Guidelines", citation: "16 C.F.R. § 310" }
    ]
  },
  {
    id: "cite-stat-civilrights",
    volume: "Statutes",
    title: "Civil Action for Deprivation of Rights",
    citation: "42 U.S.C. § 1983",
    excerpt: "Every person who, under color of any statute, ordinance, regulation, custom, or usage... subjects, or causes to be subjected, any citizen... to the deprivation of any rights, privileges, or immunities secured by the Constitution...",
    tags: ["civil rights", "remedies", "enforcement"],
    crossReferences: [
      { targetId: "cite-const-dueprocess", targetVolume: "Constitutions", label: "Constitutional Anchor", citation: "U.S. Const. amend. XIV, § 1" },
      { targetId: "cite-case-monell", targetVolume: "Case Law", label: "Municipal Liability", citation: "Monell v. Dept. of Soc. Servs., 436 U.S. 658" },
      { targetId: "cite-local-police", targetVolume: "Local Codes", label: "Municipal Oversight", citation: "NYC Admin. Code § 14-115" }
    ]
  },
  {
    id: "cite-case-gibbons",
    volume: "Case Law",
    title: "Gibbons v. Ogden — Comprehensive Commerce Scope",
    citation: "22 U.S. (9 Wheat.) 1 (1824)",
    excerpt: "Commerce, undoubtedly, is traffic, but it is something more: it is intercourse. It describes the commercial intercourse between nations, and parts of nations, in all its branches.",
    tags: ["precedent", "navigation", "interstate"],
    crossReferences: [
      { targetId: "cite-const-commerce", targetVolume: "Constitutions", label: "Constitutional Text", citation: "U.S. Const. art. I, § 8, cl. 3" },
      { targetId: "cite-stat-sherman", targetVolume: "Statutes", label: "Codified Restriction", citation: "15 U.S.C. § 1" }
    ]
  },
  {
    id: "cite-case-mathews",
    volume: "Case Law",
    title: "Mathews v. Eldridge — Procedural Due Process Standard",
    citation: "424 U.S. 319 (1976)",
    excerpt: "Due process is flexible and calls for such procedural protections as the particular situation demands. The three-factor test balances private interest, risk of erroneous deprivation, and government interest.",
    tags: ["procedure", "hearings", "administrative"],
    crossReferences: [
      { targetId: "cite-const-dueprocess", targetVolume: "Constitutions", label: "Governing Clause", citation: "U.S. Const. amend. XIV, § 1" },
      { targetId: "cite-reg-trade", targetVolume: "Regulations", label: "Rulemaking Adjudication", citation: "5 U.S.C. § 554" }
    ]
  },
  {
    id: "cite-case-monell",
    volume: "Case Law",
    title: "Monell v. Department of Social Services — Entity Accountability",
    citation: "436 U.S. 658 (1978)",
    excerpt: "Local governing bodies can be sued directly under § 1983 for monetary, declaratory, or injunctive relief where the action that is alleged to be unconstitutional implements or executes a policy statement, ordinance, regulation, or decision officially adopted.",
    tags: ["municipalities", "liability", "policy"],
    crossReferences: [
      { targetId: "cite-stat-civilrights", targetVolume: "Statutes", label: "Underlying Statute", citation: "42 U.S.C. § 1983" },
      { targetId: "cite-local-police", targetVolume: "Local Codes", label: "Local Ordinance Implementation", citation: "NYC Admin. Code § 14-115" }
    ]
  },
  {
    id: "cite-reg-trade",
    volume: "Regulations",
    title: "Commercial Disclosure & Deceptive Practices Rules",
    citation: "16 C.F.R. § 240.1 et seq.",
    excerpt: "Prohibitions against unfair or deceptive acts or practices in or affecting commerce. Specific requirements for written disclosures, verification warranties, and affirmative substantiation.",
    tags: ["FTC", "consumer", "compliance"],
    crossReferences: [
      { targetId: "cite-stat-sherman", targetVolume: "Statutes", label: "Enabling Legislation", citation: "15 U.S.C. § 45" },
      { targetId: "cite-const-commerce", targetVolume: "Constitutions", label: "Delegated Power", citation: "U.S. Const. art. I, § 8, cl. 3" }
    ]
  },
  {
    id: "cite-reg-ftc",
    volume: "Regulations",
    title: "Telemarketing & Electronic Data Safeguards",
    citation: "16 C.F.R. Part 314",
    excerpt: "Standards for safeguarding customer information; requires covered institutions to develop, implement, and maintain a comprehensive information security program.",
    tags: ["privacy", "cybersecurity", "compliance"],
    crossReferences: [
      { targetId: "cite-stat-sherman", targetVolume: "Statutes", label: "Trade Commission Authority", citation: "15 U.S.C. § 1" },
      { targetId: "cite-intl-udhr", targetVolume: "International Law", label: "Privacy Comparison", citation: "GDPR Art. 32 / UDHR Art. 12" }
    ]
  },
  {
    id: "cite-local-police",
    volume: "Local Codes",
    title: "Municipal Administrative Discipline & Public Reporting",
    citation: "NYC Admin. Code § 14-115",
    excerpt: "Discipline of members; trial of charges; right to representation and preservation of public transparency registries for administrative complaints and final dispositions.",
    tags: ["municipal", "public records", "administrative law"],
    crossReferences: [
      { targetId: "cite-stat-civilrights", targetVolume: "Statutes", label: "Federal Civil Action", citation: "42 U.S.C. § 1983" },
      { targetId: "cite-case-monell", targetVolume: "Case Law", label: "Entity Precedent", citation: "Monell, 436 U.S. 658" }
    ]
  },
  {
    id: "cite-intl-udhr",
    volume: "International Law",
    title: "Universal Declaration of Human Rights — Fair Hearing & Remedy",
    citation: "U.N. G.A. Res. 217A (III), Arts. 8 & 10",
    excerpt: "Everyone has the right to an effective remedy by the competent national tribunals for acts violating the fundamental rights granted him by the constitution or by law. Everyone is entitled in full equality to a fair and public hearing.",
    tags: ["treaty", "human rights", "international tribunals"],
    crossReferences: [
      { targetId: "cite-const-dueprocess", targetVolume: "Constitutions", label: "Constitutional Counterpart", citation: "U.S. Const. amend. XIV, § 1" },
      { targetId: "cite-case-mathews", targetVolume: "Case Law", label: "Comparative Due Process", citation: "Mathews, 424 U.S. 319" }
    ]
  }
];

export function JurisprudenceCrossReferenceSection() {
  const [selectedVolume, setSelectedVolume] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [onlyBookmarked, setOnlyBookmarked] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("tw_bookmarked_passages") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && JURISPRUDENCE_PASSAGES.some(p => p.id === hash)) {
        setActiveCitationId(hash);
        setSelectedVolume("ALL");
        setTimeout(() => {
          const el = document.getElementById(hash);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarkedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("tw_bookmarked_passages", JSON.stringify(next));
      } catch (error) { console.warn("Bookmark storage unavailable", error); }
      return next;
    });
  };

  const copyShareableLink = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = new URL(window.location.href);
    url.hash = id;
    navigator.clipboard.writeText(url.toString());
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredPassages = JURISPRUDENCE_PASSAGES.filter((p) => {
    if (onlyBookmarked && !bookmarkedIds.includes(p.id)) return false;
    const matchesVolume = selectedVolume === "ALL" || p.volume === selectedVolume;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.citation.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q));
    return matchesVolume && matchesSearch;
  });

  const jumpToCitation = (id: string) => {
    setActiveCitationId(id);
    setSelectedVolume("ALL");
    setSearchQuery("");
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };
  return (
    <section id="jurisprudence-explorer" className="scroll-mt-24 space-y-8 rounded-3xl border border-amber-500/25 bg-linear-to-b from-stone-900/90 via-stone-950 to-black p-6 sm:p-10 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-amber-500/20 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold tracking-wider text-amber-300 uppercase">
            <BookOpen className="h-3.5 w-3.5 text-amber-400" />
            Interactive Jurisprudence Concordance
          </div>
          <h2 className="mt-3 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-stone-100">
            Searchable Cross-References Across the Six Volumes
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-400">
            Trace legal authority directly through Constitutions, Statutes, Precedent, Regulations, Local Codes, and International Law with instant cited-passage navigation.
          </p>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-80">
          <label htmlFor="citation-search" className="sr-only">Search citations & principles</label>
          <div className="relative">
            <input
              id="citation-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search citations, statutes, terms..."
              className="w-full rounded-xl border border-stone-700 bg-stone-900/90 px-4 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Volume Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedVolume("ALL")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
            selectedVolume === "ALL"
              ? "bg-amber-500 text-stone-950 font-semibold shadow-md shadow-amber-500/20"
              : "border border-stone-800 bg-stone-900/70 text-stone-300 hover:border-amber-500/40"
          }`}
        >
          All Volumes ({JURISPRUDENCE_PASSAGES.length})
        </button>
        {BOOKS.map((vol) => {
          const count = JURISPRUDENCE_PASSAGES.filter((p) => p.volume === vol).length;
          const isActive = selectedVolume === vol;
          return (
            <button
              key={vol}
              type="button"
              onClick={() => setSelectedVolume(vol)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? "bg-amber-500 text-stone-950 font-semibold shadow-md shadow-amber-500/20"
                  : "border border-stone-800 bg-stone-900/70 text-stone-300 hover:border-amber-500/40 hover:text-amber-200"
              }`}
            >
              {vol} ({count})
            </button>
          );
        })}
      </div>

      {/* Passages Grid with direct cited links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPassages.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-stone-800 p-8 text-center text-stone-500 text-sm">
            No passages found matching &ldquo;{searchQuery}&rdquo;. Try another citation or keyword.
          </div>
        ) : (
          filteredPassages.map((p) => {
            const isHighlighted = activeCitationId === p.id;
            return (
              <article
                key={p.id}
                id={p.id}
                className={`group relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-300 ${
                  isHighlighted
                    ? "border-amber-400 bg-amber-950/30 shadow-[0_0_35px_rgba(245,158,11,0.25)] ring-2 ring-amber-400/50"
                    : "border-stone-800/80 bg-stone-900/50 hover:border-amber-500/40 hover:bg-stone-900/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono font-medium text-amber-300">
                      Vol: {p.volume}
                    </span>
                    <span className="font-mono text-stone-400 font-semibold">
                      {p.citation}
                    </span>
                  </div>

                  <h3 className="mt-3 font-serif text-lg font-bold text-stone-100 group-hover:text-amber-100">
                    {p.title}
                  </h3>

                  <blockquote className="mt-3 border-l-2 border-amber-500/50 pl-3.5 text-xs text-stone-300 italic leading-relaxed">
                    &ldquo;{p.excerpt}&rdquo;
                  </blockquote>

                  {/* Tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded bg-stone-800/80 px-2 py-0.5 text-[11px] text-stone-400 font-mono">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Direct Cross-Reference Links */}
                <div className="mt-5 border-t border-stone-800/80 pt-4">
                  <div className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span>Cited Passages & Cross-References:</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {p.crossReferences.map((ref) => (
                      <button
                        key={ref.targetId}
                        type="button"
                        onClick={() => jumpToCitation(ref.targetId)}
                        className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-950/60 px-3 py-1.5 text-left text-xs transition-colors hover:border-amber-500/50 hover:bg-stone-900 text-stone-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 text-[10px] font-mono">[{ref.targetVolume}]</span>
                          <span className="text-stone-300">{ref.label}:</span>
                          <span className="font-mono text-amber-200">{ref.citation}</span>
                        </div>
                        <span className="text-amber-400 text-xs">Jump &rarr;</span>
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

const BOOKS = ["Constitutions", "Statutes", "Case Law", "Regulations", "Local Codes", "International Law"] as const;

function TruthWeaverModule() {\n  return (
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
                Source-aware legal navigation and practical tools for real situations, across supported jurisdictions with unresolved coverage shown explicitly.
              </p>
              <ul className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  [BookOpen, "Source-bound", "Legal Research"],
                  [ShieldCheck, "Practical", "Tools & Templates"],
                  [Globe2, "Jurisdiction-aware", "Research"],
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
                    <a href="#legal-research" className="text-parchment/50 hover:text-parchment">Research</a>
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
                [CheckCircle2, "Source-aware Resources", "Authority and verification status stay visible"],
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

        <LegalNavigator />\n\n        <section className="mx-auto max-w-[96rem] px-5 py-10 text-xs leading-5 text-parchment/55 sm:px-6">\n          Historical and secondary legal materials are surfaced only when their provenance, edition/version, and authority role can be shown. Static demo passages are not used as governing law.\n        </section>\n      </SiteChrome>
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
}\n