import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Globe, Landmark, Menu, Search, X } from "lucide-react";

import { CartDrawer } from "./cart-drawer";

const NAV: { label: string; href: string }[] = [
  { label: "Research", href: "/#legal-research" },
  { label: "Shop", href: "/shop" },
  { label: "Notice Analyzer", href: "/notice-analyzer" },
  { label: "Document Scanner", href: "/notice-analyzer#document-scanner" },
  { label: "My workspace", href: "/dashboard" },
  { label: "Sources", href: "/sources" },
  { label: "Legal library", href: "/legal-library" },
  { label: "About", href: "/#about" },
];

export function SiteChrome({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink text-parchment">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <div className="border-b border-gold/15 bg-[linear-gradient(90deg,var(--forest-deep),var(--ink)_45%,color-mix(in_oklab,var(--violet-accent)_35%,var(--ink)))]">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <p className="min-w-0 flex-1 truncate text-center text-[10px] font-semibold uppercase tracking-[0.34em] text-gold-soft sm:text-[11px] lg:text-left xl:pl-[22rem]">
            Knowledge changes lives <span className="mx-2 text-gold" aria-hidden>|</span> Law builds fairer tomorrows
          </p>
          <div className="hidden shrink-0 items-center gap-3 text-xs text-parchment/80 md:flex">
            <a href="/connectors" className="flex items-center gap-1.5 hover:text-gold" aria-label="Global access and source center"><Globe className="h-4 w-4" aria-hidden /> Global Access</a>
            <span className="text-parchment/30" aria-hidden>|</span>
            <a href="/connectors#search" className="flex items-center gap-1.5 hover:text-gold" aria-label="Search sources"><Search className="h-4 w-4" aria-hidden /> Search</a>
            <span className="text-parchment/30" aria-hidden>|</span>
            <a href="/account" className="text-parchment/75 hover:text-gold" aria-label="Your Truth Weaver account">Account</a>
            <CartDrawer />
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-gold/15 bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[96rem] items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="group flex min-w-0 items-center gap-3">
            <Landmark className="h-10 w-10 shrink-0 text-gold drop-shadow-[0_0_12px_var(--gold)] transition group-hover:scale-105 sm:h-12 sm:w-12" aria-hidden />
            <span className="min-w-0 leading-none">
              <span className="block truncate font-serif text-xl font-semibold tracking-[0.12em] text-parchment sm:text-2xl">TRUTH WEAVER</span>
              <span className="gold-foil mt-0.5 block font-serif text-base tracking-[0.42em] sm:text-lg">COUNSEL</span>
              <span className="mt-1 hidden text-[9px] font-semibold uppercase tracking-[0.22em] text-parchment/70 sm:block">Real law. Real tools. Real impact.</span>
            </span>
          </Link>
          <nav aria-label="Primary" className="ml-auto hidden items-center gap-7 text-sm text-parchment/85 lg:flex">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className="relative py-1 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-gold after:transition-transform hover:text-gold hover:after:scale-x-100">{n.label}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:hidden">
            <a href="/connectors#search" className="rounded-full p-2 text-parchment/75 hover:text-gold" aria-label="Search sources"><Search className="h-5 w-5" /></a>
            <CartDrawer compact />
          </div>
          <button className="rounded-full p-2 text-parchment lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        <nav id="mobile-nav" aria-label="Primary mobile" className={open ? "border-t border-gold/15 px-4 pb-4 lg:hidden" : "hidden"}>
          {[...NAV, { label: "Source Center", href: "/connectors" }].map((n) => (
            <a key={n.label} href={n.href} onClick={() => setOpen(false)} className="block border-b border-parchment/5 py-3 text-sm text-parchment/85">{n.label}</a>
          ))}
        </nav>
      </header>
      <main id="main">{children}</main>
      <div className="border-y border-gold/15 bg-[linear-gradient(90deg,var(--forest-deep),var(--ink),color-mix(in_oklab,var(--violet-accent)_30%,var(--ink)))] px-4 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.34em] text-parchment/75">
        Knowledge empowers people · Law strengthens communities · Tools turn rights into real change
      </div>
      <footer className="bg-ink px-5 py-10 text-sm text-parchment/60 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-serif text-lg tracking-[0.16em] text-parchment">TRUTH WEAVER COUNSEL</p>
            <p className="mt-1 text-xs">
              A <a href="https://www.jussco.company" className="text-gold underline-offset-4 hover:underline">Juss &amp; Co.</a> product
            </p>
            <p className="mt-3 max-w-xl leading-6">
              Governing law is the authority. Truth Weaver organises legal knowledge and research; it is not a law firm,
              does not give legal advice, and never turns a book, summary or AI answer into law. For advice about your
              situation, consult a qualified lawyer in the relevant jurisdiction.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end">
            <a href="/shop" className="hover:text-gold">Shop</a>
            <a href="/notice-analyzer" className="hover:text-gold">Notice Analyzer</a>
            <a href="/connectors" className="hover:text-gold">Source Center</a>
            <a href="/sources" className="hover:text-gold">Sources</a>
            <a href="/legal-library" className="hover:text-gold">Legal Library</a>
            <a href="/#legal-research" className="hover:text-gold">Legal Research</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  const tone =
    status === "connected"
      ? "border-ok/50 text-ok"
      : status === "available"
        ? "border-gold/50 text-gold"
        : status === "needs_setup" || status === "degraded"
          ? "border-warn/50 text-warn"
          : status === "error"
            ? "border-red-400/50 text-red-300"
            : status === "connecting"
              ? "border-parchment/35 text-parchment/70"
              : "border-parchment/25 text-parchment/60";
  return (
    <span data-connector-status={status} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${tone}`}>
      {label}
    </span>
  );
}
