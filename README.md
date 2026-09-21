# Truth Weaver

Build a full-stack TypeScript app named ULTRATHINK. This is a deep-reasoning and founder decision-control system that separates evidence from inference, stress-tests decisions, and turns surviving opportunities into the smallest safe candidate tests. Implement the actual product, not a static mock.

Core models and flows:
- ContinuityCookie: subjectType repository/pull_request/document/decision/experiment/deployment/runtime/market_hypothesis; subjectRef; immutable subjectVersion; lane; observedState planned/in_progress/blocked/verified/failed/stale/superseded; narrow claim; evidenceFingerprint; evidenceRefs; previousClaimId; supersedes; dependencyIds; observedAt; expiresAt; invalidationReason; authorizing=false; standingMergeAuthority=false; approvalCarryForward=false; nextGate.
- WorldRadarFinding: classification PROVEN/EMERGING/HYPE/WHITESPACE/IRRELEVANT; claim; observed mechanism; why it appears to work; repeated failure pattern; manual workaround; underserved need; candidate product fcr/chief/promptos/storyengine/think_sprint/other; relevant primitive; adaptation hypothesis; cited sources with observedAt/sourceType; limitations; next validation gate.
- CandidatePacket: opportunity; source project_drift/project_failure/world_pattern/world_whitespace/cross_plane_reconciliation; linked lanes; project evidence refs; world evidence refs; classification documentation_correction/experiment/feature_hypothesis/workflow_improvement/risk_reduction; smallest test; expected signal; authority required none_proposal_only/founder_review/fcr_lease/production_change_control; prohibited claims; rollback; next gate.
- SnapshotBundle: title, source type paste/upload/github/manual, lane, observedAt, notes, content.

Operating doctrine:
- ULTRATHINK generates competing hypotheses, tests them, and keeps only what survives.
- TruthMode overrides ULTRATHINK when evidence conflicts.
- Red Team can veto. Never collapse distinct failures into one status. Each failure needs its own receipt/status/evidence chain.
- Evidence over reasoning. World evidence can suggest a hypothesis but cannot silently update project truth.
- Continuity fingerprints/cookies work bidirectionally but never authorize, merge, spend, or carry approval forward.
- Human controls consequence ceilings. No external spend or production mutation from this app.
- Every candidate must have smallest test, expected signal, rollback, prohibited claims, authority requirement, and next gate.

UI:
- Dashboard with Truth, Evidence Quality, Confidence, Unknowns, Blocked, stale continuity, and next gates.
- Reasoning Lab: enter a decision/problem, create competing hypotheses, attach evidence/unknowns, score survival, and show rejected hypotheses with reasons.
- Red Team page with separate failure paths, vetoes, stress tests, and evidence needed.
- OODA view showing Observe -> Orient -> Decide -> Act -> Verify -> Loop with current step and next action.
- World Radar page for findings with classifications and source limitations.
- Candidate Packets page showing the path from project/world signals to a smallest reversible test.
- Continuity page with cookies/fingerprints, predecessor/supersession, invalidation, expiration, and permanent non-authorizing labels.
- Snapshot inbox for pasted/uploaded evidence bundles.
- Decision detail should show 5W1H, consequence/authority, evidence, attacks, rollback, next gate.
- Responsive desktop/mobile, accessible focus/keyboard behavior, clear high-signal visual hierarchy.

Verification:
- Add focused unit tests for truth-over-reasoning precedence, non-authorizing continuity invariants, world-vs-project separation, candidate authority ceiling, duplicate/idempotent handling, and separate failure receipts.
- Add Playwright desktop/mobile tests for: create problem -> competing hypotheses -> evidence -> Red Team veto/survivor -> candidate packet; world finding remains hypothesis-only; stale cookie invalidates continuity; multiple blockers remain separate.
- Run typecheck/tests and Playwright where supported, fix failures, leave buildable.

Use a durable, minimal architecture. Do not add unrelated features or autonomous production actions.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8ef43cd3-8d93-4494-a685-59ce0f795614).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
