import assert from 'node:assert/strict';
import test from 'node:test';

// Node >= 22.6 type-stripping imports the TS core directly (erasable
// syntax only). The Nitro route file is a sketch and is NOT imported here.
import { invokeTruthWeaverMuse, truthWeaverMuseState } from '../server/muse-provider.ts';

const KEY = 'TEST-KEY-NOT-A-REAL-SECRET';
const ENV = { MODEL_API_KEY: KEY, TRUTH_WEAVER_MUSE_MODEL: 'muse-spark-1.3' };

function mockFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  impl.calls = calls;
  return impl;
}

const okFetch = () => mockFetch(async () => new Response(JSON.stringify({
  id: 'resp_123', status: 'completed', output_text: 'bounded answer',
}), { status: 200, headers: { 'content-type': 'application/json' } }));

test('document and user-notice sources are rejected before any network call', async () => {
  for (const source of ['documents', 'user-notice', 'user_notice', 'notice-analyzer', 'user']) {
    const fetchImpl = okFetch();
    await assert.rejects(
      () => invokeTruthWeaverMuse(ENV, { prompt: 'analyze this notice', source }, fetchImpl),
      /user_content_not_authorized/,
    );
    assert.equal(fetchImpl.calls.length, 0);
  }
});

test('founder-intelligence invoke succeeds with provider:meta evidence; key never serialized', async () => {
  const fetchImpl = okFetch();
  const result = await invokeTruthWeaverMuse(ENV, { prompt: 'challenge this positioning', source: 'founder' }, fetchImpl);
  assert.equal(result.state, 'INTEGRATED');
  assert.equal(result.evidenceRef, 'provider:meta:resp_123');
  assert.equal(result.authority, 'none');
  assert.equal(result.documentsForwarding, false);
  const sent = JSON.parse(fetchImpl.calls[0].init.body);
  assert.deepEqual(sent, { model: 'muse-spark-1.3', input: 'challenge this positioning', store: false, max_output_tokens: 2000 });
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.equal(truthWeaverMuseState({}).state, 'ABSENT');
  assert.equal(truthWeaverMuseState(ENV).scope, 'founder-intelligence');
});
