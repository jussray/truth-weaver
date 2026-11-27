# Truth Weaver · Private Search Console & Evidence Gates

Scope: frontend + server-only owner tools on `/_authenticated/owner-tools`.
Canonical production: `https://truthweaver.jussco.company/` on Cloudflare Workers.
No change to merchant operations screens, legal-source truth states, or storefront sale holds.

## Trust boundary

- Only authenticated Supabase users whose verified UUID is included in the **server secret**
  `TRUTH_WEAVER_OWNER_USER_IDS` may invoke either endpoint. No email matching, user_metadata,
  client-selected roles, cookies, or public account data grants owner access.
- Anonymous users are redirected to login and unauthorized accounts see a restricted page.
  Every server action independently rechecks the owner authorization.
- Claim and evidence are sent to the configured AI model only after explicit consent.
  No evidence is persisted by these endpoints and no customer data should be submitted.
- Model output is validated against a strict advisory-only schema. No approval, deployment,
  payment verification, legal outcome, or source-verification status can be issued by a model.

## Required protected Cloudflare bindings

- `TRUTH_WEAVER_OWNER_USER_IDS` — comma-separated Supabase Auth UUIDs, owner-approved.
- `GSC_SERVICE_ACCOUNT_JSON` — Google Cloud service account JSON with `client_email`
  and `private_key`. Grant its service account read access to the exact
  `https://truthweaver.jussco.company/` Google Search Console property and enable API.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `CLOUDFLARE_AI_GATEWAY_ID` — `truth-weaver-evidence`.
- `CLOUDFLARE_AI_API_TOKEN` — scoped server-only API token with required model/Gateway permissions.
- `CLOUDFLARE_AI_MODEL` — an explicitly authorized, available model identifier.
  The gateway is BYOK-only, authenticated, logging disabled, rate-limited; provider
  access and charges still require verification and approval.

Do not copy credential **values** into GitHub, `wrangler.jsonc`, dashboard logs, or browser code.
Missing credentials must return unavailable / connection-required, never fake index or AI results.

## Google Search Console data contract

Use the official read-only API, cache for 15 minutes, show sitemap state
and only the URLs defined in `INDEXABLE_PATHS`. URL Inspection verdicts refer
to indexed copies as last known by Google. An inspector failure is `unknown`.
The Search Console API does **not** expose the whole Page Indexing aggregate
through these endpoints; never claim a sitewide count. A submitted sitemap
does not prove indexing. No indexing API submissions are attempted.

## SEO / GEO / AEO acceptance

Public sitemap must exactly match the seven `INDEXABLE_PATHS` (not private
pages or draft products). Preserve consistent canonical, Open Graph, JSON-LD,
plain-English help, visible source limitations and `llms.txt` truthfulness.
Private tools: `noindex,nofollow` and robots exclusion. Neither robots nor
a hidden navigation link is an authorization mechanism.

## Release gates — no shortcuts

1. GREEN exact-head CI: manifest guard, lint, TypeScript, focused and complete unit
   tests, build and browser acceptance. Preserve actual runner logs and SHA.
2. Test with anonymous user, a signed-in nonowner and an explicitly allowlisted owner;
   the first two cannot retrieve status or call the model.
3. GSC service account permission: read a real sitemap receipt and inspect all seven
   public pages. Record checked timestamp; unknowns remain unknown.
4. Opted-in synthetic claim: Cloudflare AI Gateway returns validated challenge questions
   and one human gate. Missing consent, provider failures and malformed JSON fail closed.
5. Verify Cloudflare deployed version and HTTPS readbacks against the exact source SHA.
   A preview or build success does not establish production behavior.
6. Commerce separately requires credentials, durable paid-order reconciliation, refunds,
   secure claim, real fulfillment and independent payment-provider proof. Existing product
   launch holds are not waived by these features.

No real payment, secret rotation, unapproved spend, publication, or live order changes
are authorized by this implementation.
