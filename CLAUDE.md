## Canonical production domain (2026-11-11)
- The approved canonical website is https://www.truthweaver.jussco.company. The non-www hostname is a Cloudflare 301 redirect alias.
- Every public canonical tag, sitemap, robots sitemap pointer, llms.txt reference, JSON-LD application URL, and Shopify callback URI must use the www hostname. Never flip this without the founder's explicit instruction.
- A GitHub merge or build alone does not prove the Cloudflare deployment, AI gateway secret, or an actual jurisdiction-aware legal answer. Verify with live Playwright and authoritative source evidence.

# Claude Operating Contract — jussray/truth-weaver

@AGENTS.md
@AGENTS_FOUNDER_INTELLIGENCE.md

Truth Weaver is a **standalone** app: the jurisdictional legal navigation engine. Never change it to suit another app, and never change another app for it. It has no runtime dependency on peer repos (`.control-room/agent-contract.v1.json`: `runtimeDependencyOnPeers: false`). Stricter rules in `AGENTS.md` win.

## Runtime (observed on `main` 2be1b8c, 2026-10-26)
- Publish carrier: Lovable. `main` is the Lovable-connected branch: never force-push, rebase, amend or squash pushed commits, and keep `main` buildable.
- Build: `@lovable.dev/vite-tanstack-config` (Vite + Nitro, Cloudflare target). It already bundles TanStack Start, React, Tailwind, tsconfig paths and Nitro: do not add those plugins again (see `vite.config.ts`). Server entry: `src/server.ts`.
- Live URL: https://truthweaver.jussco.company (CI passes it to Playwright as `TRUTH_WEAVER_LIVE_URL`). A repo file is never proof of live state; re-observe the domain.
- Data: Supabase (`supabase/`, `drizzle/`). Server code reads secrets through `process.env`; never expose them to client bundles.
- Cloudflare runtime contract (`wrangler.jsonc`, `cloudflare/`, verify + build-readback scripts) is **pending in draft PR #13**, not on `main`.
- Observed 2026-10-26 (Cloudflare API, read-only): the live domain is DNS-only to Lovable hosting. A Cloudflare Worker `truth-weaver` exists but serves only `workers.dev` and previews, with **0 secrets** set. Do not treat a Worker deploy or preview as the live site, and do not move DNS without Juss.

- **Platform rule (Juss, 2026-10-26):** Founder Control Room (FCR) is the source platform: apps are pulled from its skills and systems. Some apps are FCR-branded; some are both standalone products and FCR extensions. A standalone app's live site is its own real domain on `*.jussco.company`, with its own brand, built from its own GitHub repo (and Lovable where used).
- **Truth Compass and Truth Weaver (Juss, 2026-10-26):** standalone apps pulled from FCR. Live sites: `compass.jussco.company` and `truthweaver.jussco.company`. Their FCR-branded URLs (`truthcompass.foundercontrolroom.org`, `truthweaver.foundercontrolroom.org`) are dropped: DNS records and Pages domains removed 2026-10-27. Do not recreate them.

## Commands
| Purpose | Command |
| --- | --- |
| Install | `npm install --no-audit --no-fund` |
| Governance carrier (no deps) | `npm run verify:founder-intelligence` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm test` |
| Build | `npm run build` |
| Playwright (dev server on :4173) | `npx playwright install chromium && npm run test:e2e` |

CI (`.github/workflows/verify.yml`) runs install → governance → lint → typecheck → unit → build → Playwright on every PR. `agent-contract-v1.yml` verifies `.control-room/agent-contract.v1.json` on the exact head.

## Claude
- Model lane: `.control-room/model-capabilities.v1.json` lists `anthropic/claude` as a **trial** lane with no selection, execution, merge, deploy, publish, spend or provider-mutation authority. The exact model is chosen per invocation by the provider execution host.
- Cloud sessions: the npm registry can be blocked in Claude Code cloud containers. If install fails, run the dependency-free checks listed above and mark build, test and Playwright results UNVERIFIED until CI passes on the exact head.
- Gates: merge, deploy, publish, secrets, database writes and provider changes need Juss's explicit go for the exact PR and head SHA. A branch push or green CI is evidence, not authority.
- Report every change as REALITY / FIX / PROOF / RISK / ROLLBACK / NEXT GATE.
