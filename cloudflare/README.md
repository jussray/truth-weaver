# Cloudflare Workers runtime

This folder and `wrangler.jsonc` declare the Cloudflare Workers runtime for Truth Weaver.

## What is declared

- `wrangler.jsonc`: worker name, `compatibility_date` 2025-04-01, and the flags `nodejs_compat` and `nodejs_compat_populate_process_env`. The flags let server code read secrets through `process.env`, which the server code relies on. With these flags, `process.env` is populated from the Worker's bindings.
- `cloudflare/secrets-manifest.json`: every secret and config name the code reads, with its class. Names and classes only. Values never enter git.
- `scripts/verify-cloudflare-runtime.mjs`: static check, no dependencies. Settings (`worker`, `scanDirs`) live in the manifest under schema `truth-weaver/cloudflare-runtime-manifest@v1`. This repo owns its copy; no other repo depends on it. Run with `npm run verify:cloudflare-runtime`. It fails if a required flag is missing, if config declares `vars` or `secrets`, if the JSON is invalid, or if the code reads a `process.env` name the manifest does not declare.

- `scripts/readback-cloudflare-build.mjs`: runs in CI right after `npm run build` and prints what the Nitro build emitted (output layout, generated wrangler config name/main/flags, var names only). This is the build readback that decides `main` and whether this root `wrangler.jsonc` matches or collides with the generated config.

## What is not declared yet (deliberate)

- `main` (the Worker entry). The Lovable build (Vite + Nitro, Cloudflare target) produces the real server bundle. Its output path has not been read back, so this file does not guess it. `wrangler deploy` is blocked until a build readback sets `main`.
- Live state. This check does not contact Cloudflare or the live site.

## Setting secrets (outside git)

    npx wrangler secret put <NAME>

Use names from `cloudflare/secrets-manifest.json` with class `secret`. Local development uses `.dev.vars`, which is gitignored.

## Rollback

Delete `wrangler.jsonc`, `cloudflare/`, `scripts/verify-cloudflare-runtime.mjs`, `scripts/readback-cloudflare-build.mjs`, the `verify:cloudflare-runtime` and `readback:cloudflare-build` script lines in `package.json`, and their two steps in `.github/workflows/verify.yml`. The app build does not read any of these files, so removing them returns the repo to its prior state.

## Proof status

- Static verifier: VERIFIED on this branch (exit 0). Broken copies fail for the stated reason: missing populate flag, undeclared `process.env` read, `vars` block, invalid JSON, worker-name drift, stray `wrangler.jsonc` with `worker: null`, old schema id.
- Build readback: verified against a synthetic `.output` only (var values never printed). Real readback is the CI step on the draft PR head.
- Build output, typecheck, unit tests, deploy and Playwright on the live path: NOT RUN. Dependency registry access was blocked in the authoring session.
