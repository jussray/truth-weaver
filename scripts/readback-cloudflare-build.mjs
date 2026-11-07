#!/usr/bin/env node
// Read back what truth-weaver's Lovable Vite + Nitro build actually emitted for Cloudflare.
// Run after `npm run build`. Prints worker config fields and var NAMES only, never values.
// Usage: node scripts/readback-cloudflare-build.mjs [rootDir]
// Exit 1 only when no build output exists; everything else is reported as evidence.

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const OUTPUT_DIRS = [".output", "dist"];
const CONFIG_FILE = /^wrangler\.jsonc?$/;
const MAX_DEPTH = 4;

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function findConfigs(dir, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const out = [];
  for (const entry of await readdir(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (await isDir(full)) out.push(...(await findConfigs(full, depth + 1)));
    else if (CONFIG_FILE.test(entry)) out.push(full);
  }
  return out;
}

const present = [];
for (const dir of OUTPUT_DIRS) if (await isDir(join(root, dir))) present.push(dir);
if (present.length === 0) {
  console.error(`cloudflare-build-readback FAIL no build output in ${OUTPUT_DIRS.join(" or ")}: run npm run build first`);
  process.exit(1);
}

console.log(`cloudflare-build-readback output=${present.join(",")}`);
for (const dir of present) {
  const top = await readdir(join(root, dir));
  console.log(`  ${dir}/: ${top.sort().join(" ")}`);
}

let declared = null;
try {
  declared = JSON.parse(await readFile(join(root, "wrangler.jsonc"), "utf8"));
} catch {
  // No repo-declared worker, or unparseable; the static verifier owns that judgement.
}

const configs = [];
for (const dir of present) configs.push(...(await findConfigs(join(root, dir))));
if (configs.length === 0) {
  console.log("  UNKNOWN no generated wrangler config in build output: worker name, main and flags are set outside this repo");
}
for (const file of configs) {
  let config;
  try {
    config = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    console.log(`  ${relative(root, file)}: unparseable (${error.message})`);
    continue;
  }
  const flags = Array.isArray(config.compatibility_flags) ? config.compatibility_flags : [];
  console.log(`  ${relative(root, file)}:`);
  console.log(`    name=${config.name ?? "-"} main=${config.main ?? "-"} compatibility_date=${config.compatibility_date ?? "-"}`);
  console.log(`    compatibility_flags=${flags.join("+") || "-"} populate_process_env=${flags.includes("nodejs_compat_populate_process_env") ? "yes" : "no"}`);
  console.log(`    var_names=${Object.keys(config.vars ?? {}).sort().join(",") || "-"} assets=${config.assets?.directory ?? "-"}`);
  if (declared?.name) {
    console.log(`    repo wrangler.jsonc name=${declared.name} ${declared.name === config.name ? "MATCHES" : "DIFFERS"} generated name`);
  }
}
