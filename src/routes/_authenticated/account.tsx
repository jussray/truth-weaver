import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getOwnerToolsAccess } from "@/lib/owner-tools.functions";

import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";
import { ShopifyCustomerConnect } from "@/components/commerce/shopify-customer-connect";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account — Truth Weaver Counsel" },
      { name: "description", content: "Your Truth Weaver account, purchases and reports." },
      { property: "og:title", content: "Account — Truth Weaver Counsel" },
      { property: "og:description", content: "Account, purchases and reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ownerToolsVisible, setOwnerToolsVisible] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({data}) => {
      if (!data.session) return;
      const access = await getOwnerToolsAccess({data:{authAccessToken:data.session.access_token}});
      if (active) setOwnerToolsVisible(access.authorized);
    }).catch(() => {if (active) setOwnerToolsVisible(false);});
    return () => { active = false; };
  }, []);
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <CounselPage title="Account" eyebrow="Signed in">
      <WorkspaceNav />
      <div className="grid gap-4">
        <section className={tw.card}>
          <p className={tw.label}>Email</p>
          <p className="mt-1">{user.email}</p>
          {ownerToolsVisible && <Link to="/owner-tools" className={`${tw.ghost} mt-4 mr-2`}>Private owner tools</Link>}
          <button onClick={signOut} className={`${tw.ghost} mt-4`}>Sign out</button>
        </section>
        <section className={tw.card}>
          <h2 className="font-serif text-xl">Purchases &amp; reports</h2>
          <p className="mt-2 text-sm text-parchment/70">Connect your Shopify customer login through the store's secure sign-in to match purchases to your Truth Weaver account. Connecting does not count as payment or unlock a report.</p>
          <div className="mt-4"><ShopifyCustomerConnect /></div>
          <Link to="/fulfillment" className={`${tw.ghost} mt-4`}>Order status, tracking and returns</Link>
          <div className="mt-4"><StateBox kind="empty">No order proof or report entitlement is available to this application yet. Snapshot downloads stay locked until verified fulfillment is deployed.</StateBox></div>
        </section>
      </div>
    </CounselPage>
  );
}
