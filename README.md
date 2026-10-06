# Truth Weaver

Truth Weaver is a standalone, evidence-first legal-navigation product. Founder Control Room may consume its provenance and receipts, but FCR is not Truth Weaver's product identity.

The governing law is the authority. Model output, summaries, legal books, confidence, prior answers, fingerprints, and continuity cookies never outrank governing law.

## Current product boundary

The current TanStack Start / React surface lets a user begin with a rough legal situation and provide:

- a question or goal;
- a place or jurisdiction hint;
- an event date and/or law-as-of date; and
- facts that may change the rule.

The legal navigator then:

1. resolves supported jurisdiction layers or fails closed when the place is too broad;
2. restricts live search to a registered official-source domain set;
3. requires live URL sources instead of silently answering from model memory;
4. fetches returned registered sources when practical;
5. applies the canonical `src/domain/law.ts` authority guard;
6. keeps unsupported citations and unresolved historical/currentness questions below `VERIFIED LAW`;
7. shows missing facts, procedure/deadline research, options, contrary-authority gaps, and next research;
8. keeps legal books and other secondary material explicitly secondary; and
9. emits an evidence-only continuity fingerprint/cookie after the useful research result.

It is legal research/navigation infrastructure, not a law firm or representation service. A disclaimer is not used as a substitute for source, jurisdiction, currentness, and authority controls.

## Implemented source-bound lane

`src/lib/legal-navigator.server.ts` uses the existing Lovable AI Gateway / OpenAI provider path and provider-executed web search. Search is allow-listed to source families registered in `src/lib/legal-navigator.ts`.

The registry currently knows source families for:

- United States federal law;
- Pennsylvania;
- Philadelphia official city material;
- United Kingdom;
- Canada;
- European Union;
- Nigeria; and
- Thailand.

This registry is **not** a claim of universal coverage. A registered or linked source family does not mean every document, historical version, local rule, court, language, or legal issue in that jurisdiction is integrated.

If live retrieval is unavailable, if the jurisdiction is unresolved, or if no returned source survives the registered-source checks, Truth Weaver fails closed rather than substituting model memory.

### Current first deep lane

The most detailed current source stack is United States federal → Pennsylvania → Philadelphia. Other registered countries/source families are expansion points with explicit coverage limits.

## Legal truth guard

`src/domain/law.ts` defines:

- `VERIFIED LAW`, `SUPPORTED`, `ALLEGED FACT`, `INFERRED`, `CONTRADICTED`, `STALE`, `JURISDICTION UNKNOWN`, `UNVERIFIED LAW`, and `NOT APPLICABLE`;
- primary, secondary, and discovery source roles;
- candidate primary-law source classes;
- jurisdiction layers;
- the fail-closed `VERIFIED LAW` guard; and
- red-team categories for contrary authority, jurisdiction, supersession, exceptions, procedure, missing elements, currentness, and authenticity.

A finding does not earn `VERIFIED LAW` merely because a model cites something. The runtime requires a resolved jurisdiction, qualifying primary-law source, citation/official identifier, official/authentic source confirmation, source retrieval/currentness evidence, and citation matching where the retrieved source text can be checked.

Historical questions remain separately constrained: current text is not silently treated as proof of what the law was on an earlier event date.

## Legal books and published authorities

Actual legal books are part of the research corpus, but their authority role stays explicit.

`src/lib/legal-books.ts` and the source-registry migration currently include metadata for identifiable published authorities including:

- William Blackstone, *Commentaries on the Laws of England* (1765);
- Joseph Story, *Commentaries on the Constitution of the United States* (1833); and
- American Law Institute, *Restatement (Second) of Contracts* (1981).

The repository does not copy copyrighted full text. Records preserve publication/licensing context and label books as secondary or historical unless the governing legal system gives a particular publication legal force.

The existing Supabase schema also supports `legal_books` and `issue_books`, alongside jurisdictions, legal sources, issues, findings, elements, remedies/defenses, red-team checks, and research logs.

## Continuity fingerprints and cookies

`src/lib/continuity.ts` implements deterministic SHA-256 evidence fingerprints.

A research fingerprint binds:

- canonical repo and branch;
- runtime/code version when available;
- research-engine version;
- a hash of the normalized question/facts rather than raw facts in the cookie;
- jurisdiction stack;
- event/as-of dates;
- source URLs/types/retrieval/currentness evidence; and
- finding states.

The browser cookie stores only the minimal marker. It is permanently `EVIDENCE_ONLY`, `NON_AUTHORIZING`, and cannot approve a filing, legal conclusion, merge, deployment, purchase, or other consequential action.

When material bound state changes, prior evidence becomes stale. `STALE != FALSE`.

## Data

The existing Supabase schema is reused rather than duplicated:

- `jurisdictions`
- `legal_sources`
- `legal_books`
- `issues`
- `findings`
- `issue_elements`
- `remedies_defenses`
- `issue_sources`
- `issue_books`
- `red_team_checks`
- `research_log`

`supabase/migrations/20261006070000_truth_weaver_source_registry.sql` seeds source-family and legal-book metadata conservatively. `linked_source_family` means registered source family, not proven exhaustive coverage.

Unauthenticated public legal research is ephemeral. Continuity cookies do not contain the user's raw legal narrative.

## Removed product mismatch

The former homepage interaction centered `fcr.truth-weaver.external-test.v1`: decision, evidence, inference, challenge, bounded test, success condition, and stop condition.

That form was a receipt generator, not the intended legal-navigation product. It is no longer the front-door experience. FCR-style evidence may be downstream provenance after legal research, but it cannot substitute for the research itself.

Static demo legal passages are also excluded from the active user path unless their provenance/currentness can meet the same source-bound standard.

## Verification

The focused correctness lane is:

```bash
npm run verify:founder-intelligence
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Focused tests include:

- `src/domain/law.test.ts` for legal authority classification;
- `src/lib/legal-navigator.test.ts` for jurisdiction resolution and fail-closed behavior;
- `src/lib/continuity.test.ts` for deterministic fingerprints, stale semantics, and non-authorizing cookies; and
- `e2e/decision-test.spec.ts` for the browser legal-navigator flow, including a continent-only jurisdiction that must fail closed rather than fabricate law.

`.github/workflows/verify.yml` runs the verifier, lint, typecheck, unit tests, production build, Chromium installation, and Playwright on pushes to `main` and pull requests.

A checked-in test or a ready preview is not by itself proof that exact-head CI/Playwright passed. Execution evidence must remain separate from source intent.

## Current source-of-truth files

- `AGENTS.md` — repository truth/authority discipline
- `src/routes/index.tsx` — customer-facing route
- `src/components/legal-navigator.tsx` — legal-research UI
- `src/lib/legal-navigator.ts` — input, jurisdiction, source-registry and output contracts
- `src/lib/legal-navigator.server.ts` — live source-bound research runtime
- `src/lib/legal-navigator.functions.ts` — server-function boundary
- `src/lib/legal-books.ts` — curated published-authority metadata
- `src/lib/continuity.ts` — fingerprints and continuity markers
- `src/domain/law.ts` — legal truth and authority rules
- `supabase/migrations/20261006070000_truth_weaver_source_registry.sql` — source/book registry seed
- `e2e/decision-test.spec.ts` — Playwright user-path proof source
- `.github/workflows/verify.yml` — executable verification lane

## Documentation rule

Current source and executed runtime evidence outrank planning prose. Never describe source-family registration, a generated answer, a preview build, or a continuity marker as proof of governing law or universal coverage.
