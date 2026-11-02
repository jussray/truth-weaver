import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SiteChrome } from "@/components/storefront/site-chrome";

export const tw = {
  input:
    "w-full rounded-md border border-gold/25 bg-ink/60 px-3 py-2 text-sm text-parchment placeholder:text-parchment/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
  btn: "inline-flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-parchment hover:border-gold hover:text-gold",
  card: "rounded-xl border border-gold/15 bg-[color-mix(in_oklab,var(--forest-deep)_45%,var(--ink))] p-5",
  label: "block text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-soft",
};

export function CounselPage({
  title,
  eyebrow,
  back,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  back?: { to: string; label: string };
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SiteChrome>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {back && (
          <a href={back.to} className="mb-4 inline-block text-sm text-parchment/70 hover:text-gold">
            ← {back.label}
          </a>
        )}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow && <p className={tw.label}>{eyebrow}</p>}
            <h1 className="mt-1 font-serif text-3xl text-parchment sm:text-4xl">{title}</h1>
          </div>
          {actions}
        </div>
        {children}
        <p className="mt-10 text-xs text-parchment/50">
          Governing law is the authority. Truth Weaver organises research and is not legal advice.
        </p>
      </div>
    </SiteChrome>
  );
}

export function StateBox({ kind, children }: { kind: "loading" | "empty" | "error"; children: ReactNode }) {
  const tone =
    kind === "error" ? "border-red-400/40 text-red-200" : "border-gold/20 text-parchment/70";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border ${tone} p-4 text-sm`}>
      {children}
    </div>
  );
}

export function WorkspaceNav() {
  const items = [
    ["/dashboard", "Dashboard"],
    ["/issues/new", "New issue"],
    ["/sources", "Sources"],
    ["/legal-library", "Legal library"],
    ["/account", "Account"],
    ["/fulfillment", "Orders and fulfillment"],
  ] as const;
  return (
    <nav aria-label="Workspace" className="mb-6 flex flex-wrap gap-2">
      {items.map(([to, label]) => (
        <Link
          key={to}
          to={to}
          className="rounded-full border border-gold/20 px-3 py-1 text-xs text-parchment/80 hover:border-gold hover:text-gold"
          activeProps={{ className: "border-gold text-gold" }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
