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
