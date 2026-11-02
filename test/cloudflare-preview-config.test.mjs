import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureCloudflarePreviewConfig } from '../scripts/ensure-cloudflare-preview-config.mjs';

async function fixture(original, run) {
  const root = await mkdtemp(join(tmpdir(), 'tw-wrangler-preview-'));
  const dir = join(root, '.output', 'server');
  await mkdir(dir, { recursive: true });
  const file = join(dir, 'wrangler.json');
  if (original !== null) await writeFile(file, original);
  try { await run({ root, file }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('preserves generated Worker identity, bindings and assets while adding preview mode', async () => {
  const input = { name: 'truth-weaver', main: './index.mjs', compatibility_date: '2026-11-01', assets: { directory: './public' }, vars: { MODE: 'test' }, routes: [{ pattern: 'example.invalid/*' }] };
  await fixture(JSON.stringify(input), async ({ root, file }) => {
    const report = ensureCloudflarePreviewConfig({ root });
    assert.equal(report.changed, true);
    const actual = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(actual, { ...input, previews: {} });
    assert.equal(ensureCloudflarePreviewConfig({ root }).changed, false);
  });
});

test('preserves existing preview settings rather than overwriting them', async () => {
  const input = { name: 'truth-weaver', previews: { enabled: true } };
  await fixture(JSON.stringify(input), async ({ root, file }) => {
    assert.equal(ensureCloudflarePreviewConfig({ root }).changed, false);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), input);
  });
});

test('fails closed if the generated Worker config is absent, malformed, or not a JSON object', async () => {
  await fixture(null, async ({ root }) => {
    assert.throws(() => ensureCloudflarePreviewConfig({ root }), /generated Wrangler config missing/i);
  });
  await fixture('not json', async ({ root }) => {
    assert.throws(() => ensureCloudflarePreviewConfig({ root }), /invalid generated Wrangler JSON/i);
  });
  await fixture('[]', async ({ root }) => {
    assert.throws(() => ensureCloudflarePreviewConfig({ root }), /expected a Wrangler configuration object/i);
  });
});
