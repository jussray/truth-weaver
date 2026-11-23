import { pageHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { LovableSignInButton } from "@/components/auth/lovable-sign-in-button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () =>
    pageHead({ path: '/signup', title: 'Create account — Truth Weaver Counsel', description: 'Private Truth Weaver account page.', noindex: true }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.user && data.user.identities?.length === 0) return setError("An account with this email may already exist. Try signing in.");
    setSent(true);
  }

  return (
    <CounselPage title="Create account" eyebrow="Account">
      {sent ? (
        <div className={`${tw.card} mx-auto max-w-md`}>
          <StateBox kind="empty">Check your email to confirm your account, then sign in.</StateBox>
          <Link to="/login" className={`${tw.ghost} mt-4`}>Go to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className={`${tw.card} mx-auto max-w-md space-y-4`}>
          <LovableSignInButton onSignedIn={() => navigate({ to: "/dashboard", replace: true })} />
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-parchment/50">
            <span className="h-px flex-1 bg-parchment/15" />or<span className="h-px flex-1 bg-parchment/15" />
          </div>
          <label className="block space-y-1">
            <span className={tw.label}>Email</span>
            <input className={tw.input} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className={tw.label}>Password (min 8)</span>
            <input className={tw.input} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <StateBox kind="error">{error}</StateBox>}
          <button className={tw.btn} disabled={busy} type="submit">{busy ? "Creating…" : "Create account"}</button>
          <p className="text-sm text-parchment/70">Have an account? <Link to="/login" className="text-gold">Sign in</Link></p>
        </form>
      )}
    </CounselPage>
  );
}
