# Truth Weaver Mobile

This directory is the first native iOS/Android client for Truth Weaver.

## Product job

Run the canonical `src/domain/law.ts` VERIFIED LAW guard on-device, fail closed when source conditions are missing, provide native haptic feedback, and share a bounded source-classification receipt through the device share sheet.

This is not a WebView wrapper and does not create a second legal-authority algorithm.

## Safety and authority boundary

The mobile gate classifies whether Truth Weaver's source conditions are present. It is not legal advice and does not authorize legal action, repository mutation, publication, spending, deployment, or deletion.

## Proof states

- SOURCE IMPLEMENTED: native Expo source, shared law guard, store identifiers, and build profiles exist.
- CI VERIFIED: the dedicated exact-head workflow must pass TypeScript, native contract tests, and both Expo platform exports.
- NATIVE BUILD VERIFIED: requires signed or reviewable native build evidence, not source manifests or JS exports.
- DEVICE VERIFIED: requires actual mobile runtime acceptance evidence.
- STORE SUBMITTED / STORE APPROVED: require App Store Connect / Google Play provider receipts.

## Intentionally absent

No store account IDs, signing keys, Google service-account file, EAS project ID, API key, or submission credential is committed here.

## Rollback

The native client is isolated under `mobile/` plus its dedicated workflow. Reverting this focused lane leaves the existing web product and canonical law rules untouched.
