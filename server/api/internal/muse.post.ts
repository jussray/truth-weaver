/**
 * SKETCH — Nitro server route for Truth Weaver (Vite/React + Nitro ->
 * Cloudflare Worker). DRAFT ONLY: not wired, not deployed.
 *
 * Target path in repo: server/api/internal/muse.post.ts
 * Depends on: ../../muse-provider.ts (target: server/muse-provider.ts)
 *
 * Before this route may go live it needs a founder-auth gate equivalent to
 * the other repos' operator keys (e.g. an env shared secret checked
 * fail-closed, as in the PromptOS draft) — that gate is intentionally NOT
 * sketched as open. Documents/user-notice content stays excluded by the
 * provider's source guard regardless of caller.
 */
import { invokeTruthWeaverMuse, truthWeaverMuseState } from '../../muse-provider';

// Nitro/h3 globals (defineEventHandler, readBody, createError) are provided
// by the Nitro runtime in-repo; they are intentionally not imported here so
// this sketch stays a design artifact, not a runnable copy-paste.
declare const defineEventHandler: (handler: (event: unknown) => Promise<unknown>) => unknown;
declare const readBody: (event: unknown) => Promise<Record<string, unknown>>;
declare const createError: (input: { statusCode: number; statusMessage: string }) => Error;

export default defineEventHandler(async (event: unknown) => {
  const env = (globalThis as { __env?: Record<string, string> }).__env ?? process.env;
  const body = await readBody(event);
  if (body?.action === 'state') return truthWeaverMuseState(env);
  try {
    return await invokeTruthWeaverMuse(env, body ?? {});
  } catch (err) {
    const code = err instanceof Error ? err.message : 'muse_request_failed';
    const statusCode = code === 'user_content_not_authorized' || code === 'sensitive_context_not_authorized'
      ? 403
      : code === 'muse_not_configured' ? 503 : code === 'invalid_prompt' ? 400 : 502;
    throw createError({ statusCode, statusMessage: code });
  }
});
