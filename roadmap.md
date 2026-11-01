# Roadmap

## Focused Shopify token repair (2026-11-01)
- [ ] Replace static-only Admin acquisition with pinned-shop client credentials, bounded per-instance cache, and denial tests; preserve merchant-only legacy fallback.
- [ ] Verify focused tests, preview checks, signed-out desktop/mobile and canonical GitHub/deployment identity. Live credentials/paid orders are not proof from fixtures.
- [ ] Production custom-app payment proof. Blocked: user-owned app creation/installation in the same Shopify organization, secure intended-app credentials and separate webhook secret; no provider changes authorized here.

## Focused private Snapshot retrieval (2026-10-31)
- [x] Replace signed URLs with bounded private binary transfer (524288 bytes), token-only newest-owned-order selection and an explicit paid-report check control. 193 Vitest + 2 Node tests and touched lint pass; preview typecheck/build OK; desktop/mobile sign-in gates pass. Authenticated paid retrieval remains unproved without an existing account and real report.
- [x] Add authenticated, owner-bound, fresh-payment-gated private PDF retrieval and honest fulfillment states; focused tests and desktop/mobile signed-out browser checks pass. Authenticated browser readback blocked: requesting user has no matching test account; no paid order/report fixture created.
- [ ] Production paid-delivery proof. Blocked: real paid order/report, confirmed production credentials and webhook registration; no external mutations authorized here.

## Approved public UX cleanup (2026-10-31)
- [x] Simplify home, legal research and notice wording; preserve source/legal/privacy guards and Shop access.
- [x] Explain source checks on existing Source Center; gate operator diagnostics with existing merchant verification. Server endpoint authorization is a separate unresolved security boundary, not proved by hiding UI.
- [ ] Complete clean desktop/mobile browser verification. Desktop actions pass; mobile actions pass but hydration warnings remain. Focused tests/lint pass; global lint has pre-existing merchant typing errors and installed JS Playwright cannot locate its matching Chromium.
- [x] Audit canonical repository/runtime and project-scoped database read-only; no publication or infrastructure changes.

## Launch execution (2026-10-27)
- [x] Reauthenticate Shopify chat tools and read existing catalog.
- [x] Run current SEO foundations, database linter, slow-query and security checks.
- [ ] Add immutable paid-order Counsel storage and authenticated issuance/readback with fresh payment verification.
- [ ] Create purchasable guides/templates/courses/bundles. Blocked: approved product prices and actual deliverable content are missing.
- [ ] Real checkout and paid delivery. Blocked: app Admin credential and Customer Account OAuth configuration absent.
- [ ] Fix sitemap after SEO approval; verify preview and request publication without claiming deployment completion.

## COUNSEL (active)
- [ ] Database: jurisdictions, legal_sources, legal_books, issues, findings, issue_elements, remedies_defenses, issue_sources, issue_books, red_team_checks
- [ ] Seed source-family registry + book categories (labelled registry, not coverage)
- [ ] Domain layer: truth states, VERIFIED LAW guard, authority classification
- [ ] Server functions (auth-scoped issues; public registry reads)
- [ ] Auth page + session
- [ ] Screens: dashboard, new issue, issue workspace tabs, authority map, source registry, legal library, coverage
- [ ] Unit tests: VERIFIED LAW guard, authority classification
- [ ] Playwright: load, create issue, registry filters, books screen, blocked VERIFIED LAW promotion
- [ ] Typecheck + tests green

## Dropped
- ULTRATHINK plan (superseded by COUNSEL request)

## Storefront (active)
- [x] Reference-matched homepage visuals + animations
- [x] Responsive on mobile/tablet/desktop (this app only; other apps out of scope)
- [ ] Connect Shopify store; real products on Shop + legal area pages with checkout
- [x] Hero triage banner: problem text -> up to 3 of the 11 legal areas (keyword match, non-authorizing)
- [ ] GitHub: connect project to GitHub. Blocked: the founder has to approve this in the editor (+ menu → GitHub → Connect project)
- [x] Notice analyzer: upload/paste notice + jurisdiction → dates, obligations, questions for counsel (AI Gateway, non-authorizing) at /notice-analyzer
- [x] index.tsx import check: no malformed import found; typecheck + production build pass
- [ ] AI-only semantic triage (no keyword fallback, honest error, validated/deduped, stale-safe)
- [ ] Harden Shopify cart: errors throw (incl 402), validate HTTPS checkout host, refresh cart before redirect
- [ ] Claim store (blocked: needs founder to click Claim in Shopify menu)
- [ ] First product (blocked: needs founder name, price, deliverable, fulfillment)
- [ ] Publish after checks

- [x] Snapshot entitlement decision seam (pure, fail-closed, revocable) + tests
- [ ] Snapshot production delivery. Blocked: Admin token secret, server-side customer binding store, entitlement table, secure report download route
- [ ] Fulfillment/status page, product images, live tests, publish. On hold per founder (no publication/sale; drafts kept)

## Merchant portal (approved interview plan)
- [x] Merchant role for founder test account + one-time vendor invites (lawyers/paralegals)
- [x] /merchant layout (sidebar, header, role gate), products price editor (one-click / typed phrase for big changes), orders (details hidden, logged reveal), activity log
- [x] Notice Analyzer: scans below 85% clarity are rejected and must be retaken
- [x] Rule tests + browser test file for price edit → activity log → confirmation message
- [x] Live catalog price round-trip (Deep Dive draft $29 → $29.01 → $29, read back) via Lovable's Shopify connection
- [ ] Portal price writes + /merchant/orders. Blocked: app's server-side Shopify admin token is rejected (401); needs a Shopify admin API token with write_products + read_orders
- [ ] Real checkout → paid Snapshot delivery. Founder approved a test sale; Snapshot must be set Active in Shopify admin (tools cannot change product status)

## Launch (founder request 2026-10-25)
- [ ] Counsel document on /fulfillment: compile Notice Analyzer results, branded PDF download + print
- [ ] "You may also like" on product pages: AI picks from real catalog only, labeled fallback
- [ ] Blurry scan browser test: blocked until a clear scan is uploaded
- [ ] SEO review (fast foundations scan) and fix failing findings
- [ ] Database check: linter + slow queries
- [ ] Shop categories (guides, templates, courses, bundles): real category pages with what each includes, honest empty state, area filters
- [ ] Guide/template/course/bundle products in Shopify. Blocked: founder must approve titles, prices and the actual deliverable files; digital delivery after payment not yet wired
- [ ] Typecheck, unit tests, Playwright, then publish the full site
