#!/usr/bin/env node
// Static check enforcing that Cloudflare Workers is the sole production runtime
// and that Vercel is strictly guarded against deploying production.
// Usage: node scripts/verify-deployment-guard.mjs [rootDir]
// Exit 0 = VERIFIED, exit 1 = FAIL.

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const failures = [];
const fail = (msg) => failures.push(msg);

async function readText(rel) {
  try {
    return await readFile(join(root, rel), "utf8");
  } catch {
    return null;
  }
}

// 1. vercel.json must exist and configure build guards
const vercelText = await readText("vercel.json");
if (vercelText === null) {
  fail("vercel.json missing: repository must configure Vercel build guards");
} else {
  let vercelConfig;
  try {
    vercelConfig = JSON.parse(vercelText);
  } catch (err) {
    fail(`vercel.json is invalid JSON: ${err.message}`);
  }
  if (vercelConfig) {
    if (!vercelConfig.ignoreCommand || typeof vercelConfig.ignoreCommand !== "string") {
      fail('vercel.json must define "ignoreCommand" to prevent production deployments');
    } else if (!vercelConfig.ignoreCommand.includes("scripts/vercel-ignore-build.sh")) {
      fail('vercel.json "ignoreCommand" must invoke scripts/vercel-ignore-build.sh');
    }

    if (!vercelConfig.buildCommand || typeof vercelConfig.buildCommand !== "string") {
      fail('vercel.json must define "buildCommand" as a fail-closed guard');
    } else if (!vercelConfig.buildCommand.includes("scripts/vercel-build-guard.sh")) {
      fail('vercel.json "buildCommand" must invoke scripts/vercel-build-guard.sh');
    }
  }
}

// 2. scripts/vercel-ignore-build.sh must exist and guard production builds (exit 0 to skip)
const ignoreScriptText = await readText("scripts/vercel-ignore-build.sh");
if (ignoreScriptText === null) {
  fail("scripts/vercel-ignore-build.sh missing");
} else {
  if (!ignoreScriptText.includes("VERCEL_ENV") || !ignoreScriptText.includes("production")) {
    fail("scripts/vercel-ignore-build.sh must inspect VERCEL_ENV for production");
  }
  if (!ignoreScriptText.includes("exit 0")) {
    fail("scripts/vercel-ignore-build.sh must exit 0 to skip production builds");
  }
}

// 3. scripts/vercel-build-guard.sh must exist and fail closed on production (exit 1)
const buildGuardText = await readText("scripts/vercel-build-guard.sh");
if (buildGuardText === null) {
  fail("scripts/vercel-build-guard.sh missing");
} else {
  if (!buildGuardText.includes("VERCEL_ENV") || !buildGuardText.includes("production")) {
    fail("scripts/vercel-build-guard.sh must inspect VERCEL_ENV for production");
  }
  if (!buildGuardText.includes("exit 1")) {
    fail("scripts/vercel-build-guard.sh must exit 1 to fail production builds on Vercel");
  }
}

// 4. wrangler.jsonc must declare Cloudflare Workers as production worker
const wranglerText = await readText("wrangler.jsonc");
if (wranglerText === null) {
  fail("wrangler.jsonc missing: Cloudflare Workers configuration required");
} else {
  try {
    const wrangler = JSON.parse(wranglerText);
    if (wrangler.name !== "truth-weaver") {
      fail(`wrangler.jsonc worker name must be "truth-weaver", got "${wrangler.name}"`);
    }
  } catch (err) {
    fail(`wrangler.jsonc is invalid JSON: ${err.message}`);
  }
}

// 5. GitHub workflows must not contain production deployment to Vercel
const verifyWorkflow = await readText(".github/workflows/verify.yml");
if (verifyWorkflow && /vercel\s+(--prod|deploy\s+--prod)/i.test(verifyWorkflow)) {
  fail(".github/workflows/verify.yml contains forbidden Vercel production deployment command");
}

if (failures.length > 0) {
  console.error("deployment-guard FAIL");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("deployment-guard VERIFIED: Vercel production blocked (ignoreCommand + buildCommand); Cloudflare Workers is sole production runtime.");
