# Cloudflare Workers runtime

This folder and `wrangler.jsonc` declare the Cloudflare Workers runtime for Truth Weaver.

## What is declared

- `wrangler.jsonc`: worker name, `compatibility_date` 2026-10-25 (matches the deployed Worker; the verifier requires >= 2025-04-01), and the flags `nodejs_compat` and `nodejs_compat_populate_process_env`. The flags let server code read secrets through `process.env`, which the server code relies on. With these flags, `process.env` is populated from the Worker's bindings.
- `cloudflare/secrets-manifest.json`: every secret and config name the code reads, with its class. Names and classes only. Values never enter git.
- `scripts/verify-cloudflare-runtime.mjs`: static check, no dependencies. Settings (`worker`, `scanDirs`) live in the manifest under schema `truth-weaver/cloudflare-runtime-manifest@v1`. This repo owns its copy; no other repo depends on it. Run with `npm run verify:cloudflare-runtime`. It fails if a required flag is missing, if config declares `vars` or `secrets`, if the JSON is invalid, or if the code reads an env name the manifest does not declare: literal `process.env` reads, `env("NAME")` wrapper calls, and connector `requiredEnv` lists all count.

- `scripts/readback-cloudflare-build.mjs`: runs in CI right after `npm run build` and prints what the Nitro build emitted (output layout, generated wrangler config name/main/flags, var names only). This is the build readback that decides `main` and whether this root `wrangler.jsonc` matches or collides with the generated config.

## Observed runtime topology (Cloudflare API readback, 2026-10-26, read-only, names only)

- `truthweaver.jussco.company`: DNS `A 185.158.133.1`, **not proxied**, with a `_lovable` verification TXT. INFERRED: the live site is served by Lovable hosting, not by this Worker.
- Zone route `*truthweaver.jussco.company/*` -> `truth-weaver` exists but cannot fire while the record is DNS-only. INFERRED: dormant.
- `www.truthweaver.jussco.company` is a custom domain on the separate `truthweaver-www-redirect` Worker.
- Worker `truth-weaver`: reachable on `workers.dev` and PR previews only. **0 secrets**, one binding (`ASSETS`), `compatibility_date` 2026-10-25, flags `nodejs_compat`. Last production deploy via wrangler at 2026-10-25T22:06Z.

Consequence: every name in `secrets-manifest.json` is currently provisioned in Lovable, not in Cloudflare. Server paths that read them fail on the Worker (previews included) until they are set there. Moving the live domain to this Worker is a founder decision. It needs every `secret`/`config` name set on the Worker, plus the DNS record switched to proxied, with a Playwright readback afterwards. Merging this folder does neither.

## Cutover to Cloudflare (founder-approved 2026-10-26; gated, in order)

1. **Set bindings on Worker `truth-weaver`.** Set every manifest name Lovable currently has set, with the same values: `npx wrangler secret put <NAME> --name truth-weaver` for `secret`, the same or dashboard vars for `config`/`public`. Skip build-identity names (`GITHUB_SHA`, `LOVABLE_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`). Values never enter git or chat.
2. **Name diff.** Use the Cloudflare API (`GET /workers/scripts/truth-weaver/secrets` and `/settings`, names only) against `secrets-manifest.json`. Every name set in Lovable must be present.
3. **Real-browser readback** of `https://truth-weaver.mcgill-raylene.workers.dev/` via Cloudflare Browser Rendering: home page, plus one Supabase-backed and one AI-backed path.
4. **DNS.** Attach `truthweaver.jussco.company` to the Worker as a custom domain, replacing the DNS-only `A 185.158.133.1`. Then re-read the live domain in a real browser.
5. **Rollback.** Remove the custom domain and restore `A truthweaver.jussco.company 185.158.133.1` (DNS-only). Lovable keeps serving throughout until step 4.

Baseline 2026-10-26 (Browser Rendering): the Worker's `workers.dev` home page server-renders the same page as the live Lovable site (same title; 57,269 vs 58,017 bytes). PR previews sit behind Cloudflare Access. Server paths that need secrets are not yet tested.

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
