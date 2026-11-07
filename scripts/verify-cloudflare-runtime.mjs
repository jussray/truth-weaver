#!/usr/bin/env node
// Static check of truth-weaver's Cloudflare Workers runtime contract.
// Settings (worker, scanDirs, env names) live in cloudflare/secrets-manifest.json.
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

const MANIFEST_PATH = "cloudflare/secrets-manifest.json";
const MANIFEST_SCHEMA = "truth-weaver/cloudflare-runtime-manifest@v1";
const MIN_COMPAT_DATE = "2025-04-01";
const REQUIRED_FLAGS = ["nodejs_compat", "nodejs_compat_populate_process_env"];
const FORBIDDEN_FLAGS = ["nodejs_compat_do_not_populate_process_env", "disallow_importable_env"];
const ENV_LITERAL = /process\.env(?:\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]|\.([A-Za-z_][A-Za-z0-9_]*))/g;
const ENV_DYNAMIC = /process\.env\[\s*[^\s"'\]]/g;
// Names reaching a dynamic read: `env("NAME")` wrapper calls and connector `requiredEnv: [...]` lists.
const ENV_WRAPPER_CALL = /\benv\(\s*["']([A-Z][A-Z0-9_]*)["']\s*\)/g;
const REQUIRED_ENV_LIST = /requiredEnv:\s*\[([^\]]*)\]/g;
const QUOTED_NAME = /["']([A-Z][A-Z0-9_]*)["']/g;
const ENTRY_KEYS = new Set(["name", "class", "usedBy"]);
const ENTRY_CLASSES = new Set(["secret", "config", "public"]);

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

// 1. Manifest: the single per-repo source of runtime settings and env names
const manifestText = await readText(MANIFEST_PATH);
let manifest = null;
if (manifestText === null) {
  fail(`${MANIFEST_PATH} missing`);
} else {
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    fail(`manifest is not valid JSON: ${error.message}`);
  }
}

const manifestNames = new Set();
const manifestClasses = new Map();
let worker = null;
let scanDirs = [];
if (manifest) {
  if (manifest.schema !== MANIFEST_SCHEMA) fail(`manifest schema must be ${MANIFEST_SCHEMA}, got ${String(manifest.schema)}`);
  if (manifest.worker !== null && (typeof manifest.worker !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(manifest.worker))) {
    fail(`manifest worker must be a lowercase worker name or null, got ${JSON.stringify(manifest.worker)}`);
  } else {
    worker = manifest.worker;
  }
  if (!Array.isArray(manifest.scanDirs) || manifest.scanDirs.length === 0 || !manifest.scanDirs.every((d) => typeof d === "string")) {
    fail("manifest scanDirs must be a non-empty list of directories");
  } else {
    scanDirs = manifest.scanDirs;
  }
  if (!Array.isArray(manifest.entries)) fail("manifest entries missing");
  for (const entry of manifest.entries ?? []) {
    for (const key of Object.keys(entry)) {
      if (!ENTRY_KEYS.has(key)) fail(`manifest entry ${entry.name ?? "?"} has disallowed key "${key}" (values are not allowed)`);
    }
    if (typeof entry.name !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(entry.name)) {
      fail(`manifest entry has invalid name: ${String(entry.name)}`);
      continue;
    }
    if (!ENTRY_CLASSES.has(entry.class)) fail(`manifest ${entry.name} has invalid class`);
    manifestNames.add(entry.name);
    manifestClasses.set(entry.name, entry.class);
  }
}

// 2. Worker declaration. worker=null means the repo declares none: the build output owns it.
const wranglerText = await readText("wrangler.jsonc");
let wrangler = null;
if (manifest && worker === null) {
  if (wranglerText !== null) fail('wrangler.jsonc exists but manifest worker is null: declare the worker name or remove the file');
  unknowns.push("UNKNOWN no repo-declared worker: runtime config comes from the build output only (see scripts/readback-cloudflare-build.mjs)");
} else if (manifest && wranglerText === null) {
  fail(`wrangler.jsonc missing but manifest declares worker ${worker}`);
} else if (wranglerText !== null) {
  try {
    wrangler = JSON.parse(wranglerText);
  } catch (error) {
    fail(`wrangler.jsonc is not valid JSON (no comments allowed): ${error.message}`);
  }
}

if (wrangler) {
  if (wrangler.name !== worker) fail(`worker name drift: wrangler.jsonc=${String(wrangler.name)} manifest=${worker}`);
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
  if (!wrangler.previews || typeof wrangler.previews !== "object" || Array.isArray(wrangler.previews)) {
    fail("wrangler.jsonc must include a previews object for Cloudflare PR preview deployments");
  }
  // Secrets never live in git-tracked config. Plain vars may carry only
  // manifest-declared config/public values (e.g. the Supabase URL and publishable key).
  if ("secrets" in wrangler) fail('"secrets" must not be declared in wrangler.jsonc (values stay out of git)');
  if ("vars" in wrangler) {
    const vars = wrangler.vars;
    if (!vars || typeof vars !== "object" || Array.isArray(vars)) fail('"vars" in wrangler.jsonc must be an object');
    for (const name of Object.keys(vars ?? {})) {
      const cls = manifestClasses.get(name);
      if (cls === undefined) fail(`wrangler.jsonc vars.${name} is not declared in ${MANIFEST_PATH}`);
      else if (cls === "secret") fail(`wrangler.jsonc vars.${name} is a secret: set it with \`wrangler secret put\`, never in git`);
    }
  }
  if (!("main" in wrangler)) {
    unknowns.push("UNKNOWN main entry not declared: `wrangler deploy` is blocked until a build-output readback sets it");
  }
}

// 3. Ignore rules for local Workers state and secrets
const gitignore = (await readText(".gitignore")) ?? "";
const ignoreLines = new Set(gitignore.split(/\r?\n/).map((line) => line.trim()));
for (const pattern of [".wrangler/", ".dev.vars"]) {
  if (!ignoreLines.has(pattern)) fail(`.gitignore missing ${pattern}`);
}

// 4. Every env name read in shipped code (literal, env() wrapper, requiredEnv list) must be declared
const seen = new Map();
const dynamicReads = new Set();
for (const dir of scanDirs) {
  for (const file of await walk(join(root, dir))) {
    const text = await readFile(file, "utf8");
    const rel = relative(root, file);
    const names = [...text.matchAll(ENV_LITERAL)].map((match) => match[1] ?? match[2]);
    names.push(...[...text.matchAll(ENV_WRAPPER_CALL)].map((match) => match[1]));
    for (const list of text.matchAll(REQUIRED_ENV_LIST)) {
      names.push(...[...list[1].matchAll(QUOTED_NAME)].map((match) => match[1]));
    }
    for (const name of names) {
      const where = seen.get(name) ?? new Set();
      where.add(rel);
      seen.set(name, where);
    }
    if (ENV_DYNAMIC.test(text)) dynamicReads.add(rel);
    ENV_DYNAMIC.lastIndex = 0;
  }
}
for (const [name, files] of [...seen].sort(([a], [b]) => a.localeCompare(b))) {
  if (!manifestNames.has(name)) fail(`process.env.${name} read in ${[...files].join(", ")} but not declared in ${MANIFEST_PATH}`);
}

// 5. Gaps are reported, not failed: dynamic reads cannot be resolved statically
for (const file of [...dynamicReads].sort()) {
  unknowns.push(`UNKNOWN dynamic process.env[...] read in ${file}: names not checked statically`);
}
for (const name of manifestNames) {
  if (!seen.has(name)) unknowns.push(`INFERRED declared-but-no-literal-read: ${name} (may be read dynamically)`);
}
unknowns.push("UNKNOWN build output, typecheck, unit tests and Playwright are not run by this static check");

if (failures.length > 0) {
  console.error("cloudflare-runtime FAIL");
  for (const message of failures) console.error(`  - ${message}`);
  for (const message of unknowns) console.error(`  ${message}`);
  process.exit(1);
}

const declared = wrangler
  ? `name=${wrangler.name} compat=${wrangler.compatibility_date} flags=${wrangler.compatibility_flags.join("+")}`
  : "worker=build-owned";
console.log(`cloudflare-runtime VERIFIED ${declared} manifest=${manifestNames.size} envNames=${seen.size} dynamicReadFiles=${dynamicReads.size}`);
for (const message of unknowns) console.log(`  ${message}`);
