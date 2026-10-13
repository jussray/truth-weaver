import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Truth Weaver Counsel" },
      { name: "description", content: "Request a password reset link for your Truth Weaver account." },
      { property: "og:title", content: "Reset password — Truth Weaver Counsel" },
      { property: "og:description", content: "Request a password reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setState("idle");
      return setError(error.message);
    }
    setState("sent");
  }

  return (
    <CounselPage title="Reset password" eyebrow="Account" back={{ to: "/login", label: "Sign in" }}>
      <form onSubmit={submit} className={`${tw.card} mx-auto max-w-md space-y-4`}>
        {state === "sent" ? (
          <StateBox kind="empty">If that email has an account, a reset link is on its way.</StateBox>
        ) : (
          <>
            <label className="block space-y-1">
              <span className={tw.label}>Email</span>
              <input className={tw.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && <StateBox kind="error">{error}</StateBox>}
            <button className={tw.btn} disabled={state === "busy"} type="submit">Send reset link</button>
          </>
        )}
        <Link to="/login" className="block text-sm text-parchment/70 hover:text-gold">Back to sign in</Link>
      </form>
    </CounselPage>
  );
}
