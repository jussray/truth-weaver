import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

// The current router exposes only `/`. Keep navigation bound to sections that
// actually exist on that route instead of advertising phantom application pages.
const NAV = [
  { href: "/#top", label: "Overview" },
  { href: "/#sources", label: "Sources" },
  { href: "/#legal-areas", label: "Legal Areas" },
  { href: "/#legal-research", label: "Legal Research" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-serif text-xl font-semibold tracking-tight">COUNSEL</span>
            <span className="label-mono hidden sm:inline">Legal intelligence workspace</span>
          </Link>
          <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {user ? (
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            ) : (
              <span className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">
                Local-first
              </span>
            )}
            <button
              className="rounded-md border border-border px-3 py-1.5 text-sm md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              Menu
            </button>
          </div>
        </div>
        <nav
          id="mobile-nav"
          aria-label="Primary mobile"
          className={cn("border-t border-border px-4 pb-3 md:hidden", open ? "block" : "hidden")}
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-muted-foreground">
        Governing law is the authority. COUNSEL organises research; it does not give legal advice and
        never turns a secondary source into law.
      </footer>
    </div>
  );
}
