# Truth Weaver scanner and Shopify catalog — review lane

This record documents implementation in PR #6, not proof of a production launch.

## Document scanner
- Public `/notice-analyzer` exposes a camera/document scanner in the existing app UI and primary navigation.
- User-initiated live camera, photo-picker fallback, up to six pages, previews, rotation, manual trim and optional rectangular page-bound suggestions.
- PDF download is generated locally from reviewed JPEG pages. OCR runs locally in the browser before optionally placing text into the existing Notice Analyzer.
- No camera image is automatically uploaded or retained on the server. Text is submitted to analysis only after the separate, existing explicit consent.
- Scanner is **mobile-web**, not a signed native iOS/Android app. Edge suggestions are conservative bounding rectangles, **not** guaranteed document segmentation or perspective correction. The user must review all text and crops.

## Shopify
- Public store uses the configured Storefront API of `fcr-truth-weaver-esimv-203acj81.myshopify.com`.
- The site distinguishes a failed API/invalid response from a successful empty public catalog. It chooses an available variant where one exists.
- Authenticated merchant portal now displays a bounded private Admin API product-status readback (active/draft/other), page-count truncation and shop currency, without publishing products.
- Price updates fail closed for non-USD shop base currency and mismatched product/variant ownership.
- Shopify returns **only products visible to the applicable sales channel and market**. Draft, archived, unlisted or otherwise unpublished products cannot be made purchasable merely by a React UI change. Do not mirror draft Admin records into public purchase cards.
- Launch-held notice report products are still **not ready for sale**. Product publishing, payments, prices, roles, Shopify configuration and customer data have not been changed.

## Proof required before release
1. Exact-head `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` pass.
2. Camera preview, permission rejection, multipage crop, PDF viewing and OCR acceptance verified on actual iOS Safari and Android Chrome.
3. Read-only Shopify provider probe verifies the Storefront API connection and the actual published catalog. A successful empty response is not a Shopify outage.
4. Merchant role and Admin scopes independently verified. Do not publish held offers before payment, entitlement and private delivery all pass.
5. Exact branch SHA reconciled with main. Production launch requires the appropriate reviewed approval and deployment receipt.

## Rollback
Revert the PR's changes or close the draft PR. No merchant data or Shopify products were changed.
