/**
 * Truth Weaver Muse provider — SERVER ROUTE ONLY, FOUNDER-INTELLIGENCE
 * ONLY. DRAFT SKETCH.
 *
 * Truth Weaver's notice-analyzer is a client-side privacy design: user
 * documents and user notices are processed locally and must NEVER be sent
 * to a model provider. The source guard below therefore rejects document /
 * user-notice content by class, before any network call:
 * - allowed sources: {founder, repository, system} (founder-intelligence);
 * - explicitly rejected: 'documents', 'user-notice', 'user_notice',
 *   'notice', 'notice-analyzer', 'user' — and anything else not allowed —
 *   as user_content_not_authorized;
 * - sensitivity must be 'standard'; anything else is rejected.
 *
 * Canonical semantics mirror the FCR reference adapter: secret name
 * MODEL_API_KEY (server env only); https://api.meta.ai/v1/responses;
 * POST {model, input, store:false, max_output_tokens:2000}; 60s timeout;
 * 64 KiB response cap; model allow-list /^muse-spark-1\.(?:1|2|3)$/ via
 * TRUTH_WEAVER_MUSE_MODEL with NO default; sanitized errors (provider
 * bodies never promoted, key never serialized); success returns
 * evidenceRef 'provider:meta:<id>' and authority 'none'.
 * State ceiling: INTEGRATED.
 */

const MAX_RESPONSE_BYTES = 64 * 1024;
const TIMEOUT_MS = 60_000;
const MAX_PROMPT_CHARS = 12_000;
const MAX_RESPONSE_ID_LENGTH = 200;
const SAFE_MUSE_MODEL = /^muse-spark-1\.(?:1|2|3)$/;
const ALLOWED_SOURCES = ['founder', 'repository', 'system'] as const;
// Named explicitly so the exclusion is reviewable, not incidental:
// document/user-notice content is barred from this provider by design.
const DOCUMENT_SOURCES = ['documents', 'document', 'user-notice', 'user_notice', 'notice', 'notice-analyzer', 'user'] as const;

export interface TruthWeaverMuseEnv {
  MODEL_API_KEY?: string;
  TRUTH_WEAVER_MUSE_MODEL?: string;
}

function safeModel(env: TruthWeaverMuseEnv): string | null {
  const normalized = String(env.TRUTH_WEAVER_MUSE_MODEL || '').trim();
  return SAFE_MUSE_MODEL.test(normalized) ? normalized : null;
}

export function truthWeaverMuseState(env: TruthWeaverMuseEnv) {
  const configured = Boolean(String(env.MODEL_API_KEY || '').trim()) && safeModel(env) !== null;
  return {
    provider: 'muse' as const,
    state: configured ? ('INTEGRATED' as const) : ('ABSENT' as const),
    model: safeModel(env),
    authority: 'none' as const,
    scope: 'founder-intelligence' as const,
    documentsForwarding: false as const,
  };
}

function validId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= MAX_RESPONSE_ID_LENGTH && /^[A-Za-z0-9._:-]+$/.test(id) ? id : null;
}

function extractText(body: Record<string, unknown>): string {
  if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const parts: string[] = [];
  for (const item of Array.isArray(body.output) ? body.output : []) {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
    if (!record || record.type !== 'message') continue;
    for (const entry of Array.isArray(record.content) ? record.content : []) {
      const block = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null;
      if (block?.type === 'output_text' && typeof block.text === 'string' && block.text.trim()) {
        parts.push(block.text.trim());
      }
    }
  }
  return parts.join('\n');
}

export async function invokeTruthWeaverMuse(
  env: TruthWeaverMuseEnv,
  input: { prompt?: unknown; sensitivity?: unknown; source?: unknown },
  fetchImpl: typeof fetch = fetch,
) {
  const prompt = String(input.prompt || '').trim();
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) throw new Error('invalid_prompt');
  if (String(input.sensitivity || 'standard').trim().toLowerCase() !== 'standard') {
    throw new Error('sensitive_context_not_authorized');
  }
  const source = String(input.source || 'founder').trim().toLowerCase();
  if ((DOCUMENT_SOURCES as readonly string[]).includes(source)
    || !(ALLOWED_SOURCES as readonly string[]).includes(source)) {
    throw new Error('user_content_not_authorized');
  }

  const keyValue = String(env.MODEL_API_KEY || '').trim();
  const model = safeModel(env);
  if (!keyValue || !model) throw new Error('muse_not_configured');

  let response: Response;
  try {
    response = await fetchImpl('https://api.meta.ai/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${keyValue}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, input: prompt, store: false, max_output_tokens: 2_000 }),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error('muse_request_failed');
  }
  if (!response.ok) {
    try { await response.body?.cancel(); } catch { /* provider error bodies are never promoted */ }
    throw new Error(`muse_http_${response.status}`);
  }
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error('muse_response_too_large');
  }
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error('muse_invalid_json'); }
  if (parsed.status !== 'completed') throw new Error('muse_non_completed');
  const responseId = validId(parsed.id);
  if (!responseId) throw new Error('muse_invalid_response_id');
  const text = extractText(parsed);
  if (!text) throw new Error('muse_empty_response');
  return {
    state: 'INTEGRATED' as const,
    provider: 'muse' as const,
    model,
    responseId,
    evidenceRef: `provider:meta:${responseId}`,
    authority: 'none' as const,
    source,
    documentsForwarding: false as const,
    text,
  };
}
