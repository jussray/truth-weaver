# Roadmap

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
- [ ] Live price write + round-trip test. Blocked: store's server-side admin connection is rejected by Shopify; needs reconnecting the Shopify admin app token
- [ ] Real checkout → paid Snapshot delivery. Blocked: same store connection, and Snapshot is still on launch hold (founder approval needed to go live)
