# Truth Weaver owner visibility and evidence gates

Scope: `jussray/truth-weaver`; canonical production host is Cloudflare `truthweaver.jussco.company`. The current code is a **candidate only** until exact-head CI and Cloudflare deployment/readback pass. Never remove the existing Shopify launch holds on the strength of this feature.

## Private access

Authenticated users land on `/account`. Only a **server-confirmed allowlisted project owner** sees the `/owner-tools` link; both server actions independently recheck Supabase Auth identity on every request. The private page is `noindex,nofollow`; public `robots.txt` excludes it. A hidden link, robots.txt, or a browser token is *not* an authorization mechanism. All status and AI work is performed on the server, never with a browser API credential.

Bind as protected Cloudflare Worker secrets / runtime settings (values never in git):

- Existing Supabase service: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Protect the service role key, verify project identity and RLS before any other change.
- `TRUTH_WEAVER_OWNER_USER_IDS`: comma-separated Supabase **Auth user UUIDs** authorized by the founder; no email, user_metadata or browser-selected role grants owner access.
- Google: `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN`, optional `GSC_PROPERTY_URL` (default `https://truthweaver.jussco.company/`). Grant the OAuth identity read access to that Search Console property and enable the API.
- Cloudflare model: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_GATEWAY_ID=truth-weaver-evidence`, `CLOUDFLARE_AI_API_TOKEN`, optional `CLOUDFLARE_AI_MODEL`. Use minimum scoped privileges, a configured provider with known costs, and zero server-side prompt logging. The gateway is authenticated, BYOK-only, log-disabled and rate-limited, but **is not proven operational** until model readback passes.

## Acceptance gates

1. **Exact source:** check out the candidate SHA with no persisted credentials. Pass the focused regression tests, lint, TypeScript and build. A green unrelated SHA is not evidence.
2. **Unauthorized traffic:** verify anonymous sessions and other users cannot retrieve private status or invoke AI; link must stay hidden for those users.
3. **Google live:** check property permission, sitemap processing/error/warning report and six canonical URL inspections against Google Search Console. Inspected URL counts are **samples**, not Google's site-wide page-indexing totals. Unknown/failed status stays unknown.
4. **AI live:** authorized consenting user submits synthetic non-private claim and evidence, verifies structured gaps, challenge questions and next gate. No automatic status flip, deploy, approval, payment, or legal determination. Invalid consent and malformed provider output fail closed.
5. **Public discoverability:** verify `robots.txt`, `sitemap.xml`, `llms.txt`, public canonical links/structured data, and rendered 200 responses on Cloudflare. Never claim Google indexed a page simply because it is in a sitemap.
6. **Commerce independent:** keep the paid-order release blocked pending live Shopify secret bindings, durable webhook handling (duplicates, retries, refunds), secure account claims, and a real owner-scoped entitlement delivery test.
7. **Provenance:** record SHA, deployment ID, UTC time, authorized actor, before/after checks and actual results. No undocumented PR, merge, or Cloudflare deploy.

Source-only or simulated tests do not establish external provider availability. Do not place Google tokens, Shopify secrets, customer data or claim bodies in CI logs, AI Gateway logs, `llms.txt`, client JS or public telemetry.
