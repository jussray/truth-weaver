# Truth Weaver owner intelligence — production gates (2026-11-02)

Scope: `jussray/truth-weaver`, branch `feat/owner-search-evidence-20261102`, based on `main@3651a5ccf2a5d5b99c75983bf6e915e0a5ebf283`. This is an **authored branch**, not production deployment or proof.

## Delivered in source (unverified runtime)

- Private `/merchant/search-console` monitoring UI (Google sitemaps + per-URL Search Console Index Inspection, six public canonical paths only).
- Private `/merchant/evidence-review` claim/evidence challenge UI with explicit consent.
- Server functions require valid Supabase access token AND `has_role(user, merchant) = true` on every request.
- Cloudflare AI Gateway request is server-only. Model output is strict-validated, advisory, and never a verified/approved status.
- Both paths are `noindex`, absent from public sitemap, and fall under robots disallow for `/merchant`.
- Contract tests added to `npm run test`; **no test execution claimed**.

## Provider connection prerequisites (server secrets only)

Search Console: `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN`; optional `GSC_SITE_URL`, restricted to the canonical prefix or the two approved domain properties. Google access token must have `webmasters.readonly` scope and actual permission to view the specified property. Do not commit refresh tokens or Google credentials.

Cloudflare: `CF_AI_GATEWAY_ACCOUNT_ID`, `CF_AI_GATEWAY_ID=truth-weaver-evidence`, `CF_AI_GATEWAY_API_TOKEN` (least-privilege Workers AI Read as documented) and optional `CF_AI_GATEWAY_MODEL`. The account has an existing authenticated gateway with request logs disabled, but the Truth Weaver Worker had no listed secrets on 2026-11-02. Configure bindings securely at the actual runtime; do not paste tokens into GitHub or browser code. Confirm billing limits before a live model request.

## Required release verification — DO NOT SKIP

1. Verify exact GitHub head, run frozen dependency install, founder intelligence gate, lint, typecheck, full unit/Node tests, production build, Playwright merchant access/UI regression and unauthorized POST denial. No new PR, merge, deployment or bypass while any check is red or absent.
2. Confirm the deployed Cloudflare Worker receives the correct Supabase + Google + AI Gateway secrets, without exposing their values. Test an unauthorized visitor, regular signed-in user and approved merchant.
3. Search Console: verify property access, sitemap API response (including submission/download/error timestamps), and URL Inspection results against the same property. Distinguish UNKNOWN, NOT_INDEXED, INDEXED and request failures. Do not invent a site-wide indexing count from six sampled URLs.
4. AI Gateway: test one consented bounded claim and evidence set, a malicious instruction embedded in evidence, malformed model JSON, provider quota failure and missing credentials; confirm no automatic release/publish or VERIFIED state.
5. Public SEO/AEO/GEO: inspect live HTML 200s, canonical/robots/sitemap parity, crawlable internal links, content accuracy and structured-data-to-visible-copy parity; verify Search Console indexing with timestamps. Google says no special AI markup is needed. Adding unsupported schema or arbitrary lastmod is not a shortcut.
6. Keep Shopify launch holds intact until product deliverables, dedicated custom-app installation, admin token, paid-order webhook signature verification, order-to-PDF entitlement, buyer-access test, live checkout and independent readback are proven. At 2026-11-02 inspection the three Notice products were Shopify DRAFT and tagged `launch-hold`. Guides, templates, courses and bundles were not observed as catalog products; don't represent them as sellable.
7. Confirm Cloudflare remains the canonical live host. Only release after exact-head gates are green and founder authorizes merge/deployment.

## Evidence boundaries

- Source write in GitHub = AUTHORED, not deployed.
- Existing gateway (direct Cloudflare GET) = OBSERVED metadata, not successful inference.
- Shopify product list (connected Shopify Admin) = OBSERVED catalog statuses, not a working checkout.
- Google indexing data = UNKNOWN until authenticated Search Console API response.
- Full test/production runtime status = UNVERIFIED until execution receipts exist.
