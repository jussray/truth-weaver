/**
 * Lovable OAuth redirect receiver. Canonical redirect (registered in Lovable):
 * https://www.truthweaver.jussco.company/auth/lovable/callback
 *
 * Fail-closed stub. The authorization-code exchange is NOT implemented, so this
 * handler never reads, stores, logs or echoes the code and never calls Lovable.
 * It answers only what the request alone can prove:
 * - method other than GET → 405
 * - provider error parameter → 400 (error code only, value not echoed)
 * - missing code or state → 400
 * - otherwise → 503 not_configured until the exchange is built and reviewed
 */
export const LOVABLE_CALLBACK_PATH = "/auth/lovable/callback";

const NO_STORE_HEADERS = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
};

function reply(body: { ok: false; reason: string }, status: number, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE_HEADERS, ...extra } });
}

export function handleLovableOauthCallback(request: Request): Response {
  if (request.method !== "GET") return reply({ ok: false, reason: "method_not_allowed" }, 405, { allow: "GET" });

  const params = new URL(request.url).searchParams;
  if (params.has("error")) return reply({ ok: false, reason: "provider_error" }, 400);
  if (!params.get("code") || !params.get("state")) return reply({ ok: false, reason: "invalid_request" }, 400);

  return reply({ ok: false, reason: "not_configured" }, 503);
}
