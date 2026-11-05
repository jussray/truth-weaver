import { pageHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";

const safePath = (p?: string) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/dashboard");

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () =>
    pageHead({ path: '/login', title: 'Sign in — Truth Weaver Counsel', description: 'Private Truth Weaver account page.', noindex: true }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate({ to: safePath(redirect), replace: true });
  }

  return (
    <CounselPage title="Sign in" eyebrow="Account">
      <form onSubmit={submit} className={`${tw.card} mx-auto max-w-md space-y-4`}>
        <label className="block space-y-1">
          <span className={tw.label}>Email</span>
          <input className={tw.input} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className={tw.label}>Password</span>
          <input className={tw.input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <StateBox kind="error">{error}</StateBox>}
        <button className={tw.btn} disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
        <div className="flex justify-between text-sm text-parchment/70">
          <Link to="/forgot-password" className="hover:text-gold">Forgot password?</Link>
          <Link to="/signup" className="hover:text-gold">Create account</Link>
        </div>
      </form>
    </CounselPage>
  );
}
