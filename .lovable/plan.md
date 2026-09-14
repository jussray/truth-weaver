# ULTRATHINK — build plan

A founder decision-control system that keeps evidence and inference apart, attacks decisions before they ship, and converts survivors into the smallest reversible test.

## One decision I need from you

**Where does the data live?**

- **Option A (recommended): Lovable Cloud + sign-in.** Your decisions, cookies, findings and packets persist across devices, private to your account. Adds a login screen.
- **Option B: single-device storage.** No login, data stays in the browser you used. Faster to ship, not durable across machines.

I will build **Option A** unless you say otherwise. Everything below is the same either way.

## Pages

1. **Dashboard** — Truth, Evidence Quality, Confidence, Unknowns, Blocked, stale continuity, next gates.
2. **Reasoning Lab** — state a decision, spawn competing hypotheses, attach evidence and unknowns, score survival, keep rejected ones visible with reasons.
3. **Red Team** — one row per failure path (never merged), vetoes, stress tests, evidence needed.
4. **OODA** — Observe to Orient to Decide to Act to Verify to Loop, with current step and next action.
5. **World Radar** — findings classified PROVEN / EMERGING / HYPE / WHITESPACE / IRRELEVANT with sources and limitations, permanently marked hypothesis-only.
6. **Candidate Packets** — signal to smallest reversible test, with authority ceiling and rollback.
7. **Continuity** — cookies and fingerprints, predecessor and supersession chains, invalidation, expiry, permanent "non-authorizing" label.
8. **Snapshot Inbox** — paste or upload evidence bundles.
9. **Decision detail** — 5W1H, consequence and authority, evidence, attacks, rollback, next gate.

## Rules enforced in code (not just displayed)

- TruthMode beats ULTRATHINK: conflicting verified evidence overrides reasoning-derived status.
- Continuity cookies are always `authorizing: false`, `standingMergeAuthority: false`, `approvalCarryForward: false` — not editable anywhere in the UI.
- World evidence can only create hypotheses; it can never promote project truth on its own.
- A candidate packet is invalid without smallest test, expected signal, rollback, prohibited claims, authority requirement and next gate.
- Authority ceiling caps at proposal / founder review / lease / change control — the app never spends or mutates production.
- Distinct failures keep distinct receipts; blockers never collapse into one status.
- Stale or expired cookies invalidate continuity automatically and surface on the dashboard.

## Technical notes

- Domain layer as pure TypeScript (`src/domain/*`): zod schemas, state machines, survival scoring, invariant guards. All rules live here so they are testable without the UI.
- Data access via typed server functions (`createServerFn`) over Lovable Cloud tables with per-user row security; idempotency keys on writes so duplicate submits do not duplicate records.
- Design system defined in `src/styles.css` (dark control-room palette, mono accents), no ad-hoc colors in components.
- Unit tests (Vitest) for: truth-over-reasoning precedence, non-authorizing invariants, world-vs-project separation, authority ceiling, idempotent writes, separate failure receipts.
- Playwright desktop and mobile flows: problem to competing hypotheses to evidence to Red Team veto to candidate packet; world finding stays hypothesis-only; stale cookie invalidates continuity; multiple blockers stay separate.
- Typecheck, unit tests and Playwright run before I report done; failures fixed, build left green.
