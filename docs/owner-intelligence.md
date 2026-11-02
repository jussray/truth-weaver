# Truth Weaver owner intelligence — implementation gate (2026-11-02)

## Scope and source
Feature branch: `feat/owner-evidence-search-console-20261102`. Truth Weaver's public legal research, Commerce, Source Center, and SEO canon remain unchanged. New paths `/merchant/seo` and `/merchant/evidence` are private/noindex and must NOT be inserted into `public/sitemap.xml` or `INDEXABLE_PATHS`.

## Authorization
Both server actions use `requireSupabaseAuth` and re-check a merchant role *and* the explicit server-side `TW_OWNER_USER_IDS` allowlist. A vendor granted merchant access is not automatically a project owner. With no configured IDs, deny all reads/model calls. A client-side route guard is only UX; server authorization is mandatory.

## Search Console setup (not completed)
Use the existing production runtime's secrets mechanism only; never commit tokens or paste secrets in chat.
- `TW_OWNER_USER_IDS`: comma-separated authenticated Supabase UUIDs approved for project ownership.
- `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN`: Google OAuth client and an owner-granted refresh token with the least-privileged `https://www.googleapis.com/auth/webmasters.readonly` scope. Refresh token needs secure revocation/rotation and ownership audit.
- `GSC_PROPERTY`: EXACTLY `https://truthweaver.jussco.company/` or `sc-domain:jussco.company`. Verify property access via Google Search Console before declaring connected.
- Enable Search Console API in the correct Google Cloud project; inspect API quotas and restrictions. Do not expose the OAuth access/refresh tokens to React, logs, or browsers.

The server requests submitted sitemap metadata and individually inspects the six canonical public URLs. A sitemap being submitted/processed is not page indexing. The old `sitemap.contents[].indexed` field is deprecated; never display an indexed total based on it. URL Inspection describes Google's indexed version, not a live crawl. If API data is missing, state UNKNOWN. 403, 429 and provider errors are not "not indexed". Never submit indexing requests or mutate Search Console in this view.

## Evidence challenge
- `LOVABLE_API_KEY` must remain server-only. Requires a permitted, working Lovable AI Gateway model and confirmed account quota.
- Inputs are untrusted: one claim (max 2500 chars), up to 10 evidence text items (max 1500 chars each), optional HTTPS source links. The AI does not open links, and the UI explicitly says this.
- Strict output: evidence gaps, attack questions, one of four non-authorizing next gates (COLLECT_EVIDENCE, CHALLENGE, HUMAN_REVIEW, HOLD), limitations.
- No model output can approve law, truth, release, payment, publishing, or authorization. Preserve the original user inputs in the active browser only. The provider processes text; `store:false` is an API request flag, NOT a promise about provider retention.
- For legal claims: local Truth Weaver jurisdiction/primary-source/citation verification remains governing; a language model review cannot promote a law proposition to VERIFIED LAW.

## SEO / AEO / GEO
Keep public canonical sitemap limited to verified indexable pages in `src/lib/seo.ts`. Maintain their accurate titles, descriptions, breadcrumbs, schema.org content that matches visible facts, crawlable sources, robots instructions and stable site identity. No fake ratings, unverified authority, service availability, offers, testimonials, indexing counts or guarantees of ranking/AI mentions. These private owner pages are `noindex` and should not be exposed as public SEO landing pages.

## Evidence and release rules
Local validation (2026-11-02): four standalone `node:test` cases passed for claim bounds, AI gate parsing, sitemap processing semantics and indexing verdict normalization. Not a repository-wide typecheck/test/build or runtime proof. GitHub branch tests have been added but CI status is unknown until exact-head verification.
Required before merge/deploy: full repository install from frozen lockfile, targeted tests, typecheck, lint, build, desktop/mobile browser checks, negative unauthenticated/vendor tests, Google OAuth readback with approved property, AI Gateway real authorized review with malformed/attack prompt fixtures, confirm no secret exposure, review Cloudflare deployment and Source Center legal guards. Do not create PR or merge/deploy without founder's explicit authorization and all exact-head checks green.

## Rollback
Leave branch unmerged or revert its commit sequence. Production remains unchanged. Preserve source SHA/actor/UTC test receipts; do not represent an authored feature as deployed or verified by a preview.

## Follow-up verification receipt — 2026-11-02
- Scope: owner Search Console and Evidence Challenge ONLY; no legal-research, store, Cloudflare, or production mutation.
- Local regression harness (Node 22/TypeScript 5.8.3, isolated `src/lib/owner-review.ts`): RED demonstrated (a) unrelated `*.jussco.company` sitemap leaking into Truth Weaver monitor, (b) PASS with a different Google-selected canonical reported as success, and (c) absent bounded concurrency helper. After fixes, **7/7 standalone Node tests pass**. This is not the repository-wide Vitest/TypeScript/build/browser test suite.
- Fixes were authored in GitHub: limit displayed sitemap URLs to the Truth Weaver origin; represent missing Google status metrics as null rather than zero; keep PASS with a different Google canonical **unverified**; request up to three URL inspections concurrently with original URL ordering; add focused Vitest assertions.
- GitHub status for branch commit `a085bc1a602c1db5a0ddadf2f6f2b5da6f4005a2`: Vercel reported `success`; no PR-triggered GitHub Actions workflow runs returned. Vercel status is not Cloudflare deployment or functional verification.
- Connected Cloudflare account readback: Worker `truth-weaver` last listed deployment `afb3602b-3319-4e8a-9d2c-bae5f360812d` at `2026-11-01T02:30:44.769422Z`, 100% version `584b3ef4-3bea-4b1f-8de7-9e43d3636f16`, metadata source `wrangler`.
- The Cloudflare version API provided binding names, and **did not list** `TW_OWNER_USER_IDS`, `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN`, `GSC_PROPERTY` or `LOVABLE_API_KEY`. Absence in this version response is a configuration gap for that deployment, not proof that no credentials exist outside it. No secret values were retrieved.
- External live website web inspection remained inaccessible from available web tool. No user-authorized Search Console OAuth readback, real Lovable AI run, browser journey, or release authorization is recorded.
- Release gate stays BLOCKED pending secure server configuration, current code/runtime binding review, green exact-head tests, authenticated owner and vendor negative tests, read-only GSC property/URL inspection and model proof, followed by explicit founder merge/deploy approval. Do not create a PR, merge, publish or spend just to bypass a missing gate.
