import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";

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
          <button onClick={signOut} className={`${tw.ghost} mt-4`}>Sign out</button>
        </section>
        <section className={tw.card}>
          <h2 className="font-serif text-xl">Purchases &amp; reports</h2>
          <StateBox kind="empty">Not available yet. Products are on launch hold until paid orders and delivery are verified. No purchases are shown here.</StateBox>
        </section>
      </div>
    </CounselPage>
  );
}
