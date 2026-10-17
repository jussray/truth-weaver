import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CounselPage, tw } from "@/components/counsel/page";
import { authed } from "@/lib/merchant/authed-call";
import { redeemVendorInvite } from "@/lib/merchant/portal.functions";

export const Route = createFileRoute("/_authenticated/vendor-invite")({
  head: () => ({ meta: [{ title: "Vendor Invite | Truth Weaver" }, { name: "description", content: "Redeem a one-time vendor invite to join the Truth Weaver merchant portal." }] }),
  component: VendorInvite,
});

function VendorInvite() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await authed(redeemVendorInvite, { code: code.trim() }).catch(() => ({ ok: false }));
    setState(r.ok ? "ok" : "bad");
  }

  return (
    <CounselPage title="Redeem a vendor invite" eyebrow="Merchant access">
      <form onSubmit={submit} className={`${tw.card} max-w-lg space-y-3`}>
        <label className={tw.label} htmlFor="code">Invite code</label>
        <input id="code" value={code} onChange={(e) => setCode(e.currentTarget.value)} className={tw.input} autoComplete="off" />
        <button className={tw.btn} disabled={code.trim().length !== 36}>Redeem</button>
        {state === "ok" && <p role="status" className="text-sm text-ok">Merchant access granted. <Link to="/merchant/products" className="underline">Open the portal</Link>.</p>}
        {state === "bad" && <p role="alert" className="text-sm text-danger">That code is invalid, used, or expired.</p>}
      </form>
    </CounselPage>
  );
}
