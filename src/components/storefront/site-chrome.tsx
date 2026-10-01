import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Globe, Menu, Search, ShoppingBag, User, X, Scale } from "lucide-react";

const NAV: { label: string; href: string }[] = [
  { label: "Shop", href: "/shop" },
  { label: "Legal Areas", href: "/#legal-areas" },
  { label: "Guides", href: "/shop?category=guides" },
  { label: "Templates", href: "/shop?category=templates" },
  { label: "Courses", href: "/shop?category=courses" },
  { label: "Bundles", href: "/shop?category=bundles" },
  { label: "About", href: "/#about" },
];

export function SiteChrome({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink text-parchment">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <div className="border-b border-gold/20 bg-forest-deep px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.32em] text-gold-soft sm:text-[11px]">
        Knowledge changes lives <span className="mx-2 text-gold" aria-hidden>|</span> Law builds fairer tomorrows
      </div>
      <header className="sticky top-0 z-40 border-b border-gold/15 bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-gold/50 bg-forest-deep text-gold shadow-[0_0_30px_-6px_var(--gold)]">
              <Scale className="h-5 w-5" aria-hidden />
            </span>
            <span className="leading-none">
              <span className="block font-serif text-xl font-semibold tracking-[0.16em] text-parchment">TRUTH WEAVER</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.5em] text-gold">Counsel</span>
            </span>
          </Link>
          <nav aria-label="Primary" className="ml-auto hidden items-center gap-6 text-sm text-parchment/75 lg:flex">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className="transition-colors hover:text-gold">{n.label}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 lg:ml-4">
            <a href="/connectors" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs text-parchment/75 hover:text-gold sm:flex" aria-label="Global access and source center">
              <Globe className="h-4 w-4" aria-hidden /> Global Access
            </a>
            <a href="/connectors#search" className="rounded-full p-2 text-parchment/75 hover:text-gold" aria-label="Search sources"><Search className="h-5 w-5" /></a>
            <span className="rounded-full p-2 text-parchment/40" aria-label="Account (sign-in not required to browse)" title="Account"><User className="h-5 w-5" /></span>
            <a href="/shop" className="rounded-full p-2 text-parchment/75 hover:text-gold" aria-label="Cart"><ShoppingBag className="h-5 w-5" /></a>
            <button className="rounded-full p-2 text-parchment lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <nav id="mobile-nav" aria-label="Primary mobile" className={open ? "border-t border-gold/15 px-4 pb-4 lg:hidden" : "hidden"}>
          {[...NAV, { label: "Source Center", href: "/connectors" }].map((n) => (
            <a key={n.label} href={n.href} onClick={() => setOpen(false)} className="block border-b border-parchment/5 py-3 text-sm text-parchment/85">{n.label}</a>
          ))}
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-gold/15 bg-ink px-5 py-10 text-sm text-parchment/60 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-serif text-lg tracking-[0.16em] text-parchment">TRUTH WEAVER COUNSEL</p>
            <p className="mt-3 max-w-xl leading-6">
              Governing law is the authority. Truth Weaver organises legal knowledge and research; it is not a law firm,
              does not give legal advice, and never turns a book, summary or AI answer into law. For advice about your
              situation, consult a qualified lawyer in the relevant jurisdiction.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end">
            <a href="/shop" className="hover:text-gold">Shop</a>
            <a href="/connectors" className="hover:text-gold">Source Center</a>
            <a href="/#decision-test" className="hover:text-gold">Decision Test</a>
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
        : status === "needs_setup"
          ? "border-warn/50 text-warn"
          : "border-parchment/25 text-parchment/60";
  return (
    <span data-connector-status={status} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${tone}`}>
      {label}
    </span>
  );
}
