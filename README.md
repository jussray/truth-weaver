# Truth Weaver Counsel

Truth Weaver Counsel is an evidence-first legal knowledge and decision-support module for Founder Control Room.

This README describes the implementation that exists on `main`. Older ULTRATHINK build-spec language remains historical intent only when it is not represented by current code.

## Current product boundary

The current application is a single TanStack Start / React surface that helps a user:

1. navigate broad legal-problem categories;
2. understand the distinction between primary, secondary, and discovery sources;
3. keep evidence separate from inference;
4. stress-test a proposed decision;
5. define a bounded next test, success condition, and stop condition; and
6. export a non-authorizing decision receipt.

It is educational decision infrastructure. It is not a law firm, does not provide representation, and does not turn model output into governing law.

## Current implementation

### Browser surface

`src/routes/index.tsx` is the current customer-facing route.

It implements:

- legal-area navigation;
- source-layer explanation;
- a decision stress-test form;
- local browser persistence for the in-progress form;
- a downloadable/copyable `fcr.truth-weaver.external-test.v1` receipt; and
- a permanent `authority: "non-authorizing"` boundary.

The current browser surface does **not** implement the older multi-page ULTRATHINK specification for World Radar, Candidate Packets, continuity-cookie management, a standalone OODA page, a separate Red Team page, or a snapshot inbox.

Those names must not be presented as current product capabilities unless current source later implements and proves them.

### Legal truth guard

`src/domain/law.ts` contains the current legal-domain rules.

The domain layer defines:

- truth states such as `VERIFIED LAW`, `SUPPORTED`, `INFERRED`, `CONTRADICTED`, `STALE`, and `JURISDICTION UNKNOWN`;
- candidate primary-law source classes;
- source roles and authority classification;
- jurisdiction layers;
- a fail-closed `VERIFIED LAW` guard; and
- red-team categories for contrary authority, jurisdiction problems, superseding law, exceptions, procedure, missing elements, currentness, and authenticity.

A claim reaches `VERIFIED LAW` only when the guard has a resolved jurisdiction, a qualifying primary-law source, a citation or official identifier, an explicit official/authenticity check, at least one attached primary-law source confirmed official or authentic, and a currentness check.

A model response, secondary source, discovery source, confidence score, user preference, or known unauthentic reproduction cannot satisfy that guard by itself.

## Truth boundary

Keep these states separate:

```text
source exists
-> source class and jurisdiction resolved
-> currentness/authenticity checked
-> claim classified
-> user decision stress-tested
-> non-authorizing receipt
```

None of those steps authorizes filing, contacting a court or agency, spending money, signing an agreement, changing a provider, merging code, deploying software, or taking another consequential external action.

## Persistence and data

The current decision-test draft is stored in browser `localStorage` under the module's local storage key.

The repository includes Supabase client configuration, but the current decision-test flow described above is local-first. Do not describe browser persistence as durable server-side case storage unless a separately implemented and verified path proves that claim.

## Verification

Runnable verification now includes:

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e
```

`src/domain/law.test.ts` covers the legal authority guard, including rejection of secondary-only and known unauthentic primary-law inputs.

`e2e/decision-test.spec.ts` runs the current customer-facing decision flow in Playwright on desktop and mobile Chromium projects. It verifies that a completed stress test produces the bounded receipt and preserves its `non-authorizing` boundary without page or console errors.

`.github/workflows/verify.yml` runs typecheck, unit tests, lint, build, installs Chromium, and runs the Playwright suite on pushes to `main` and pull requests. A checked-in test is not by itself proof of a green run; current CI status remains the execution authority for that claim.

## Development

```bash
npm install
npm run dev
```

## Current source-of-truth files

- `src/routes/index.tsx` - current user-facing product surface
- `src/domain/law.ts` - legal truth and authority rules
- `src/domain/law.test.ts` - focused domain tests
- `e2e/decision-test.spec.ts` - browser journey proof
- `playwright.config.ts` - desktop/mobile browser configuration
- `.github/workflows/verify.yml` - executable verification lane
- `package.json` - runnable package commands

## Documentation rule

Current `main` implementation outranks historical build prompts and planning prose.

If future code restores or implements World Radar, Candidate Packets, continuity cookies, multi-page Red Team/OODA flows, external research, server persistence, or additional authority/evidence machinery, update this README only after those paths exist and can be verified.
