# Truth Weaver personalized Shopify report release gates

State: **IMPLEMENTATION BRANCH ONLY — NOT RELEASE-VERIFIED**
Date: 2026-11-08

## Authored flow

1. Notice Analyzer still works without login; a separately unchecked opt-in allows signed-in users to save **server-produced** findings, excluding the original raw notice text, into `tw_saved_analyses`.
2. The browser keeps a session-only pointer to that saved analysis. A report-item checkout requires the current Supabase account to own that analysis.
3. The server issues an expiring, random purchase claim in `tw_purchase_claims`. The Storefront API attaches `_tw_claim` to the cart while preserving other attributes. Checkout stops unless the live cart confirms the exact nonce.
4. Shopify `orders/paid` webhooks must pass HMAC/shop/topic checks. When a claimed report is present, only a **fresh Shopify Admin order read** plus the matching server-side claim can produce a private per-order report. The old Snapshot entitlement path is preserved for unclaimed orders.
5. `/fulfillment` lists account-owned per-order reports and independently checks payment, ownership and private PDF bytes before preview/download. The prior free browser Counsel document and legacy Snapshot section remain.

## Verification required before releasing or removing product launch holds

- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run verify:design-system`, `npm run build`, and relevant Playwright mock tests on **the exact branch head**. CI and deployment must be distinguished from these tests.
- Verify `tw_saved_analyses`, `tw_purchase_claims`, and `tw_order_reports` exist in the *production* Supabase project with the expected columns, RLS, service-role-only writes and private storage bucket. The SQL under `drizzle/migrations/0001_tw_paid_order_reports.sql` does **not** by itself establish it was applied to production.
- Install the intended custom Shopify app on `fcr-truth-weaver-esimv-203acj81.myshopify.com` through Shopify's own authorized installation process. A separate ChatGPT Shopify connector cannot install this app or prove its client ID is active.
- Independently verify scoped server-side Admin credentials without exposing secrets in logs, chat, the browser, or repository code.
- Verify webhook registration, HMAC secret, exact Shopify shop, order status, report claim, and Shopify order `customAttributes` readback. Use synthetic, non-paying tests first; any real paid test requires explicit merchant authorization.
- **Performance hold:** the claimed-order webhook currently renders a PDF inline. Shopify webhook acknowledgments have a narrow response window; measure actual time and, if necessary, move report generation to a durable asynchronous queue before release. Do not return success for a report that has neither been durably accepted for processing nor generated.
- Verify authorized account isolation, duplicate-webhook idempotence, expired/missing claim, refunds/revocation, cart restoration, guest checkout, wrong-store rejection and no report access when Shopify Admin is unavailable.
- For Cloudflare, verify runtime secrets and binding availability, deployed Git SHA equivalence, and real user journey on `truthweaver.jussco.company`. A Vercel preview status is not Cloudflare production verification.
- Maintain existing launch holds for report products until the entire paid flow is verified. Do not merge or deploy with red or missing required checks.

## Known non-proof

A successful Vercel build is not proof that the custom app is installed, the Supabase migration is applied, a webhook is registered, or any paid PDF can be delivered. Neither app installation nor production DB/Worker changes are made by this source branch.
