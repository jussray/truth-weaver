import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { useState } from "react";

import { tw } from "@/components/counsel/page";
import { lovable } from "@/integrations/lovable/index";

/** Managed "Continue with Lovable" sign-in. Returns to the public site root, never a protected route. */
export function LovableSignInButton({ onSignedIn }: { onSignedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("lovable", { redirect_uri: window.location.origin });
    if (result.error) {
      setBusy(false);
      setError("Sign in with Lovable didn't finish. Please try again.");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
    onSignedIn();
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={handleClick} disabled={busy} className={`${tw.ghost} w-full`}>
        <LovableMark />
        {busy ? "Opening Lovable…" : "Continue with Lovable"}
      </button>
      {error ? <p role="alert" className="text-sm text-warn">{error}</p> : null}
    </div>
  );
}
