import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

/**
 * Wrangler Preview requires a top-level previews block. TanStack/Nitro
 * generates the effective .output/server/wrangler.json from the Cloudflare
 * build; update only that generated artifact, never production credentials,
 * routes, bindings or the checked-in source configuration.
 */
export function ensureCloudflarePreviewConfig({ root = process.cwd() } = {}) {
  const file = join(root, '.output', 'server', 'wrangler.json');
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('Generated Wrangler config missing; build must produce .output/server/wrangler.json.');
    throw error;
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error('Invalid generated Wrangler JSON; refusing to mutate a malformed build artifact.');
  }
  if (config === null || Array.isArray(config) || typeof config !== 'object') {
    throw new Error('Expected a Wrangler configuration object.');
  }
  if (config.previews !== undefined) {
    if (config.previews === null || Array.isArray(config.previews) || typeof config.previews !== 'object') {
      throw new Error('Existing Wrangler previews block must be an object.');
    }
    return { changed: false };
  }
  config.previews = {};
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return { changed: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = ensureCloudflarePreviewConfig();
  console.log(result.changed ? 'Generated Wrangler preview block added' : 'Generated Wrangler preview block already present');
}
