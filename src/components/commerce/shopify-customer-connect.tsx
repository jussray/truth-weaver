import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { customerLinkStatus, connectShopifyCustomer } from "@/lib/commerce/shopify-customer-link.functions";
import { checkMySnapshotPurchases } from "@/lib/commerce/snapshot-reconciliation.functions";
import { trustedShopifyEndpoint } from "@/lib/commerce/shopify-customer-link";

const SHOP_HOST = "fcr-truth-weaver-esimv-203acj81.myshopify.com";
const ACCOUNT_REDIRECT = "https://truthweaver.jussco.company/account";
const STORAGE_KEY = "tw-shopify-oauth-pkce";
const MAX_OAUTH_AGE_MS = 5 * 60 * 1000;
const clientId: string = import.meta.env["VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID"] ?? "";

type OAuthPending = { state: string; verifier: string; createdAt: number; supabaseUserId: string };

function randomBase64Url(bytes = 48): string {
  const raw = new Uint8Array(bytes);
  crypto.getRandomValues(raw);
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const hashed = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...hashed)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function ShopifyCustomerConnect() {
  const [status, setStatus] = useState<"loading" | "linked" | "unlinked" | "working">("loading");
  const [error, setError] = useState<string | null>(null);
  const [checkingOrders, setCheckingOrders] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const canonical = typeof window === "undefined" || window.location.origin === new URL(ACCOUNT_REDIRECT).origin;
  const configured = clientId.length > 4 && canonical;

  useEffect(() => {
    let active = true;
    async function load() {
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");
      const state = search.get("state");
      const providerError = search.get("error");
      if (code || providerError) {
        // Remove one-time OAuth codes immediately from visible URL and browser history.
        window.history.replaceState(window.history.state, "", "/account");
      }
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session || !active) {
        if (active) {
          setError("Sign in to Truth Weaver again before connecting a Shopify account.");
          setStatus("unlinked");
        }
        return;
      }
      if (providerError) {
        sessionStorage.removeItem(STORAGE_KEY);
        if (active) setError("Shopify login did not complete. Nothing was linked.");
      } else if (code) {
        setStatus("working");
        const raw = sessionStorage.getItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        let pending: OAuthPending | null = null;
        try { pending = raw ? JSON.parse(raw) as OAuthPending : null; } catch { /* Invalid local state. */ }
        if (!pending || !state || state !== pending.state || !/^[A-Za-z0-9_-]{43,128}$/.test(pending.verifier) ||
          Date.now() - pending.createdAt > MAX_OAUTH_AGE_MS || pending.createdAt > Date.now() ||
          pending.supabaseUserId !== session.user.id) {
          if (active) setError("Shopify sign-in expired or did not match this account. Please retry.");
        } else {
          try {
            const outcome = await connectShopifyCustomer({ data: {
              supabaseAccessToken: session.access_token,
              authorizationCode: code,
              codeVerifier: pending.verifier,
              redirectUri: ACCOUNT_REDIRECT,
            } });
            if (!outcome.linked && active) setError("Shopify could not securely verify the connection. No purchase was unlocked.");
            if (outcome.linked && active) setStatus("linked");
          } catch {
            if (active) setError("The account connection could not be verified. Retry later.");
          }
        }
      }
      try {
        const result = await customerLinkStatus({ data: { authAccessToken: session.access_token } });
        if (active) setStatus(result.linked ? "linked" : "unlinked");
      } catch {
        if (active) { setStatus("unlinked"); setError("Account link status is currently unavailable."); }
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function checkPaidSnapshots() {
    if (status !== "linked" || checkingOrders) return;
    setCheckingOrders(true);
    setOrderStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setOrderStatus("Your Truth Weaver session expired. Sign in again.");
        return;
      }
      const verified = await checkMySnapshotPurchases({ data: { authAccessToken: data.session.access_token } });
      if (verified.state === "verified") {
        setOrderStatus(verified.recorded > 0
          ? "Shopify payment verified for " + verified.recorded + " Snapshot purchase(s). Open Order status to check private report availability."
          : "No eligible paid Snapshot order was found for this connected customer.");
      } else if (verified.state === "not_linked") {
        setOrderStatus("Your verified Shopify account connection is missing. Reconnect before checking orders.");
      } else if (verified.state === "not_authenticated") {
        setOrderStatus("Your session has expired. Sign in again.");
      } else {
        setOrderStatus("Shopify order verification is unavailable. No purchases or entitlements were asserted.");
      }
    } catch {
      setOrderStatus("Shopify order verification is unavailable. No access was granted.");
    } finally {
      setCheckingOrders(false);
    }
  }

  async function startShopifySignIn() {
    if (!configured) return;
    setError(null);
    setStatus("working");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("missing_auth");
      const response = await fetch(`https://${SHOP_HOST}/.well-known/openid-configuration`, {
        headers: { Accept: "application/json" }, redirect: "error",
      });
      if (!response.ok) throw new Error("no_discovery");
      const discovered = await response.json() as { authorization_endpoint?: string };
      if (!discovered.authorization_endpoint ||
        !trustedShopifyEndpoint(discovered.authorization_endpoint, "authorization", SHOP_HOST)) {
        throw new Error("bad_endpoint");
      }
      const verifier = randomBase64Url();
      const state = randomBase64Url(32);
      const challenge = await pkceChallenge(verifier);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        state, verifier, createdAt: Date.now(), supabaseUserId: data.session.user.id,
      } satisfies OAuthPending));
      const url = new URL(discovered.authorization_endpoint);
      url.searchParams.set("scope", "openid email customer-account-api:full");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", ACCOUNT_REDIRECT);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      window.location.assign(url.toString());
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      setError("Shopify customer login is not configured or reachable. Orders are still available in Shopify.");
      setStatus("unlinked");
    }
  }

  if (status === "loading") return <p role="status" className="text-sm text-parchment/60">Checking your secure store connection...</p>;
  return (
    <div className="space-y-3" data-testid="shopify-customer-connect">
      <p role="status" className="text-sm text-parchment/80">
        {status === "linked" ? "Shopify customer identity verified and linked. Payment and report delivery are verified separately."
          : "No verified Shopify identity is connected to this Truth Weaver account."}
      </p>
      {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
      {status === "linked" && (
        <div className="space-y-2 rounded-xl border border-gold/20 p-3">
          <button type="button" disabled={checkingOrders}
            onClick={() => void checkPaidSnapshots()}
            className="inline-flex items-center rounded-full border border-gold/40 px-4 py-2 text-sm text-gold disabled:opacity-50">
            {checkingOrders ? "Checking Shopify payment..." : "Verify my $10 Snapshot purchases"}
          </button>
          {orderStatus && <p role="status" className="text-sm text-parchment/70">{orderStatus}</p>}
          <p className="text-xs text-parchment/60">
            Only Shopify-confirmed, non-test paid orders can create an entitlement. Private report access
            requires a separate entitlement and fresh server-side verification.
          </p>
        </div>
      )}
      {status !== "linked" && (
        <button type="button" disabled={!configured || status === "working"}
          onClick={() => void startShopifySignIn()}
          className="inline-flex items-center rounded-full border border-gold/40 px-4 py-2 text-sm text-gold disabled:cursor-not-allowed disabled:opacity-50">
          {status === "working" ? "Connecting securely..." : "Connect Shopify customer account"}
        </button>
      )}
      {!configured && <p className="text-xs text-parchment/60">
        Account linking is awaiting the store's Customer Account OAuth client configuration on the main Truth Weaver domain.
        Continue viewing orders through Shopify in the meantime.
      </p>}
      <p className="text-xs text-parchment/60">
        Truth Weaver stores temporary PKCE state in this tab during connection and clears it on return. Your Truth Weaver login session remains managed separately by Supabase. Shopify orders require independent payment verification.
      </p>
    </div>
  );
}
