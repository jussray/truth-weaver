# Truth Weaver owner proof tools — 2026-11-02

## Scope and isolation
Private pages: /merchant/search-console and /merchant/claim-review. Both live under the existing merchant-only layout, rechecking authenticated \`merchant\` role in **every server function**. No new auth system, database, queue, or public API is created. These paths must remain noindex and disallowed by robots.txt.

## Google Search Console source
The monitor uses official Google Search Console **read-only** API scopes and inspects only the six canonical URLs in \`INDEXABLE_PATHS\`. Sitemap submission/processing is reported from the sitemap API; per-URL indexed state from URL Inspection. The deprecated sitemap indexed counter is never used. Counts apply to inspected public URLs only; no estimate is presented as a Google total. Cache TTL is 15 minutes.

To connect, grant the authorized service-account email *read access* to the exact \`https://truthweaver.jussco.company/\` property in Search Console, enable Search Console API, and set **GSC_SERVICE_ACCOUNT_JSON** as a protected server-only Cloudflare Worker secret containing \`client_email\` and \`private_key\`. Do not put credentials in GitHub, Pages assets, or browser JS. The panel shows **Connection required** until credentials work. No secret was provisioned by this source change.

## AI Gateway claim challenge
Uses the existing Lovable AI Gateway provider and existing server-only \`LOVABLE_API_KEY\` deployment secret. Claim and 1–6 evidence entries are validated, passed to the model only after explicit user consent, and **never written to a repository or database** by this feature. The model never fetches evidence URLs; its gaps, attack questions and next gate are suggestions only. Publishing, legal claims, release approvals and status changes remain separate founder/human gates.

## Evidence and no-overlap rule
The merchant portal's existing authorization, source registry and SEO helpers are the sole sources reused here. These two panels must not become competing project-wide Canon Knowledge Registries or new checkout/release channels. CI verifies lint, types, helper tests, full app tests/build, and synthetic no-session visitor denial. Provider-backed status and model inference remain unverified until connected credentials, request readback, and controlled user journeys succeed.
