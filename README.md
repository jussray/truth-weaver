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

A claim reaches `VERIFIED LAW` only when the current guard has a resolved jurisdiction, a qualifying primary-law source, a citation or official identifier, known official/authentic status, and a currentness check.

A model response, secondary source, discovery source, confidence score, or user preference cannot satisfy that guard by itself.

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

## Verification status

The repository currently exposes these package scripts:

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
npm run lint
npm run format
```

`src/domain/law.test.ts` exists as focused domain test source, but `package.json` does not currently expose a `test` or Playwright script. Therefore this README does **not** claim an automated end-to-end Playwright proof lane or a package-level test command until that wiring exists and is verified.

## Development

```bash
npm install
npm run dev
```

## Current source-of-truth files

- `src/routes/index.tsx` — current user-facing product surface
- `src/domain/law.ts` — legal truth and authority rules
- `src/domain/law.test.ts` — focused domain test source
- `package.json` — runnable package commands

## Documentation rule

Current `main` implementation outranks historical build prompts and planning prose.

If future code restores or implements World Radar, Candidate Packets, continuity cookies, multi-page Red Team/OODA flows, external research, server persistence, or additional authority/evidence machinery, update this README only after those paths exist and can be verified.