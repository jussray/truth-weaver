import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Truth Weaver Counsel" },
      { name: "description", content: "Create a private Truth Weaver workspace for your legal research." },
      { property: "og:title", content: "Create account — Truth Weaver Counsel" },
      { property: "og:description", content: "Save legal issues, sources and findings privately." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
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
