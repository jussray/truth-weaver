import { pageHead } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () =>
    pageHead({ path: '/reset-password', title: 'Set new password — Truth Weaver Counsel', description: 'Private Truth Weaver account page.', noindex: true }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => setReady(Boolean(s.session) || isRecovery));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <CounselPage title="Set a new password" eyebrow="Account">
      <div className={`${tw.card} mx-auto max-w-md space-y-4`}>
        {ready === null && <StateBox kind="loading">Checking reset link…</StateBox>}
        {ready === false && <StateBox kind="error">This reset link is invalid or expired. Request a new one.</StateBox>}
        {ready && (
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1">
              <span className={tw.label}>New password (min 8)</span>
              <input className={tw.input} type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <StateBox kind="error">{error}</StateBox>}
            <button className={tw.btn} disabled={busy}>Update password</button>
          </form>
        )}
      </div>
    </CounselPage>
  );
}
