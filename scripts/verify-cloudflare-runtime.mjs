#!/usr/bin/env node
// Static check of the Cloudflare Workers runtime declaration.
// No dependencies: Node built-ins only, so it runs without registry access.
// Usage: node scripts/verify-cloudflare-runtime.mjs [rootDir]
// Exit 0 = VERIFIED, exit 1 = FAIL. It never reads or prints secret values.

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const failures = [];
const unknowns = [];
const fail = (msg) => failures.push(msg);

const MIN_COMPAT_DATE = "2025-04-01";
const REQUIRED_FLAGS = ["nodejs_compat", "nodejs_compat_populate_process_env"];
const FORBIDDEN_FLAGS = ["nodejs_compat_do_not_populate_process_env", "disallow_importable_env"];
const SCAN_DIRS = ["src", "server"];
const ENV_LITERAL = /process\.env(?:\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]|\.([A-Za-z_][A-Za-z0-9_]*))/g;
const MANIFEST_KEYS = new Set(["name", "class", "usedBy"]);
const MANIFEST_CLASSES = new Set(["secret", "config", "public"]);

async function readText(rel) {
  try {
    return await readFile(join(root, rel), "utf8");
  } catch {
    return null;
  }
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(entry) && !/\.test\.[a-z]+$/.test(entry)) out.push(full);
  }
  return out;
}

// 1. Worker declaration
const wranglerText = await readText("wrangler.jsonc");
let wrangler = null;
if (wranglerText === null) {
  fail("wrangler.jsonc missing");
} else {
  try {
    wrangler = JSON.parse(wranglerText);
  } catch (error) {
    fail(`wrangler.jsonc is not valid JSON (no comments allowed): ${error.message}`);
  }
}

if (wrangler) {
  if (wrangler.name !== "truth-weaver") fail(`worker name drift: ${String(wrangler.name)}`);
  if (typeof wrangler.compatibility_date !== "string" || wrangler.compatibility_date < MIN_COMPAT_DATE) {
    fail(`compatibility_date must be >= ${MIN_COMPAT_DATE}, got ${String(wrangler.compatibility_date)}`);
  }
  const flags = Array.isArray(wrangler.compatibility_flags) ? wrangler.compatibility_flags : [];
  for (const flag of REQUIRED_FLAGS) {
    if (!flags.includes(flag)) fail(`compatibility flag missing: ${flag}`);
  }
  for (const flag of FORBIDDEN_FLAGS) {
    if (flags.includes(flag)) fail(`compatibility flag forbidden here: ${flag}`);
  }
  // Secrets and vars must never be declared in git-tracked config.
  for (const key of ["vars", "secrets"]) {
    if (key in wrangler) fail(`"${key}" must not be declared in wrangler.jsonc (values stay out of git)`);
  }
  if (!("main" in wrangler)) {
    unknowns.push("UNKNOWN main entry not declared: `wrangler deploy` is blocked until a build-output readback sets it");
  }
}

// 2. Ignore rules for local Workers state and secrets
const gitignore = (await readText(".gitignore")) ?? "";
const ignoreLines = new Set(gitignore.split(/\r?\n/).map((line) => line.trim()));
for (const pattern of [".wrangler/", ".dev.vars"]) {
  if (!ignoreLines.has(pattern)) fail(`.gitignore missing ${pattern}`);
}

// 3. Secrets manifest: names and classes only
const manifestText = await readText("cloudflare/secrets-manifest.json");
const manifestNames = new Set();
if (manifestText === null) {
  fail("cloudflare/secrets-manifest.json missing");
} else {
  let manifest = null;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    fail(`secrets manifest is not valid JSON: ${error.message}`);
  }
  if (manifest) {
    if (manifest.schema !== "truth-weaver/cloudflare-secrets-manifest@v1") fail("manifest schema drift");
    if (!Array.isArray(manifest.entries)) fail("manifest entries missing");
    for (const entry of manifest.entries ?? []) {
      for (const key of Object.keys(entry)) {
        if (!MANIFEST_KEYS.has(key)) fail(`manifest entry ${entry.name ?? "?"} has disallowed key "${key}" (values are not allowed)`);
      }
      if (typeof entry.name !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(entry.name)) {
        fail(`manifest entry has invalid name: ${String(entry.name)}`);
        continue;
      }
      if (!MANIFEST_CLASSES.has(entry.class)) fail(`manifest ${entry.name} has invalid class`);
      manifestNames.add(entry.name);
    }
  }
}

// 4. Every literal process.env read in shipped server/app code must be declared
const seen = new Map();
for (const dir of SCAN_DIRS) {
  for (const file of await walk(join(root, dir))) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(ENV_LITERAL)) {
      const name = match[1] ?? match[2];
      const where = seen.get(name) ?? new Set();
      where.add(relative(root, file));
      seen.set(name, where);
    }
  }
}
for (const [name, files] of [...seen].sort(([a], [b]) => a.localeCompare(b))) {
  if (!manifestNames.has(name)) fail(`process.env.${name} read in ${[...files].join(", ")} but not declared in cloudflare/secrets-manifest.json`);
}

// 5. Declared names the code no longer reads are reported, not failed (dynamic reads exist)
for (const name of manifestNames) {
  if (!seen.has(name)) unknowns.push(`INFERRED declared-but-no-literal-read: ${name} (may be read dynamically via connector registry or env parameter)`);
}

unknowns.push("UNKNOWN build output, typecheck, unit tests and Playwright are not run by this static check");

if (failures.length > 0) {
  console.error("cloudflare-runtime FAIL");
  for (const message of failures) console.error(`  - ${message}`);
  for (const message of unknowns) console.error(`  ${message}`);
  process.exit(1);
}

console.log(
  `cloudflare-runtime VERIFIED name=${wrangler.name} compat=${wrangler.compatibility_date} flags=${wrangler.compatibility_flags.join("+")} manifest=${manifestNames.size} literalEnvNames=${seen.size}`,
);
for (const message of unknowns) console.log(`  ${message}`);
