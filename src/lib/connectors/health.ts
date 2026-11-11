import { sha256Canonical, type JsonValue } from "./custody";
import type { ProviderId } from "./provenance";
import {
  resolveConnectorStatus,
  type ConnectorDefinition,
  type ConnectorStatus,
  type EnvPresence,
} from "./registry";

export type ConnectorCapability =
  | "identity_read"
  | "storefront_read"
  | "public_source"
  | "built_in_ai"
  | "configuration_only";

export type ConnectorHealth = {
  provider: ProviderId;
  status: ConnectorStatus;
  capability: ConnectorCapability;
  scope: Record<string, string> | null;
  checkedAt: string;
  lastSuccess: string | null;
  receipt: `sha256:${string}`;
  detail: string;
};

export type ConnectorSecretEnv = Record<string, string | undefined>;

type ProbeSuccess = {
  ok: true;
  capability: "identity_read" | "storefront_read";
  scope: Record<string, string> | null;
  detail: string;
};

type ProbeFailure = {
  ok: false;
  capability: "identity_read" | "storefront_read";
  detail: string;
};

type ProbeResult = ProbeSuccess | ProbeFailure;

const READ_ONLY_PROVIDERS = new Set<ProviderId>(["github", "slack", "notion", "linear", "shopify"]);

function envPresence(def: ConnectorDefinition, env: ConnectorSecretEnv): EnvPresence {
  return Object.fromEntries(
    def.requiredEnv.map((name) => [name, typeof env[name] === "string" && env[name]!.length > 0]),
  );
}

function healthProbeEnvNames(def: ConnectorDefinition) {
  return def.healthProbeEnv?.length ? def.healthProbeEnv : def.requiredEnv;
}

function isHealthProbeConfigured(def: ConnectorDefinition, env: ConnectorSecretEnv) {
  const names = healthProbeEnvNames(def);
  return names.length > 0 && names.every((name) => Boolean(env[name]));
}

function sanitizeScope(scope: Record<string, unknown> | null): Record<string, string> | null {
  if (!scope) return null;
  const entries = Object.entries(scope)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .map(([key, value]) => [key, String(value)] as const)
    .filter(([, value]) => value.length <= 200);
  return entries.length ? Object.fromEntries(entries) : null;
}

async function mintHealth(input: Omit<ConnectorHealth, "receipt">): Promise<ConnectorHealth> {
  const receipt = await sha256Canonical({
    provider: input.provider,
    status: input.status,
    capability: input.capability,
    scope: (input.scope ?? null) as JsonValue,
    checkedAt: input.checkedAt,
    lastSuccess: input.lastSuccess,
    detail: input.detail,
  });
  return { ...input, receipt };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function probeGitHub(env: ConnectorSecretEnv): Promise<ProbeResult> {
  const response = await fetchWithTimeout("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env["GITHUB_API_KEY"]}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "truth-weaver-connector-health",
    },
  });
  if (!response.ok) {
    return { ok: false, capability: "identity_read", detail: `GitHub identity read failed (${response.status}).` };
  }
  const body = (await readJson(response)) as { login?: unknown; id?: unknown } | null;
  if (!body || typeof body.login !== "string") {
    return { ok: false, capability: "identity_read", detail: "GitHub identity read returned an unusable response." };
  }
  return {
    ok: true,
    capability: "identity_read",
    scope: sanitizeScope({ login: body.login, id: body.id }),
    detail: "GitHub authenticated identity read succeeded.",
  };
}

async function probeSlack(env: ConnectorSecretEnv): Promise<ProbeResult> {
  const response = await fetchWithTimeout("https://slack.com/api/auth.test", {
    method: "POST",
    headers: { Authorization: `Bearer ${env["SLACK_BOT_TOKEN"]}` },
  });
  const body = (await readJson(response)) as
    | { ok?: unknown; team_id?: unknown; user_id?: unknown; team?: unknown }
    | null;
  if (!response.ok || body?.ok !== true) {
    return { ok: false, capability: "identity_read", detail: `Slack auth.test failed (${response.status}).` };
  }
  return {
    ok: true,
    capability: "identity_read",
    scope: sanitizeScope({ teamId: body.team_id, userId: body.user_id, team: body.team }),
    detail: "Slack auth.test succeeded.",
  };
}

async function probeNotion(env: ConnectorSecretEnv): Promise<ProbeResult> {
  const response = await fetchWithTimeout("https://api.notion.com/v1/users/me", {
    headers: {
      Authorization: `Bearer ${env["NOTION_API_KEY"]}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!response.ok) {
    return { ok: false, capability: "identity_read", detail: `Notion integration identity read failed (${response.status}).` };
  }
  const body = (await readJson(response)) as { id?: unknown; type?: unknown } | null;
  if (!body || typeof body.id !== "string") {
    return { ok: false, capability: "identity_read", detail: "Notion integration identity read returned an unusable response." };
  }
  return {
    ok: true,
    capability: "identity_read",
    scope: sanitizeScope({ integrationId: body.id, type: body.type }),
    detail: "Notion integration identity read succeeded.",
  };
}

async function probeLinear(env: ConnectorSecretEnv): Promise<ProbeResult> {
  const response = await fetchWithTimeout("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: env["LINEAR_API_KEY"] ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "query ConnectorHealth { viewer { id } }" }),
  });
  const body = (await readJson(response)) as
    | { data?: { viewer?: { id?: unknown } | null } | null; errors?: unknown }
    | null;
  const viewerId = body?.data?.viewer?.id;
  if (!response.ok || typeof viewerId !== "string") {
    return { ok: false, capability: "identity_read", detail: `Linear viewer read failed (${response.status}).` };
  }
  return {
    ok: true,
    capability: "identity_read",
    scope: sanitizeScope({ viewerId }),
    detail: "Linear viewer identity read succeeded.",
  };
}

function normalizeShopifyDomain(value: string) {
  return value.trim().replace(/^https?:\/\//i, "").split("/")[0] ?? "";
}

async function probeShopify(env: ConnectorSecretEnv): Promise<ProbeResult> {
  const domain = normalizeShopifyDomain(env["SHOPIFY_STORE_DOMAIN"] ?? "");
  if (!/^[a-z0-9.-]+$/i.test(domain)) {
    return { ok: false, capability: "storefront_read", detail: "Shopify store domain is invalid." };
  }
  const apiVersion = env["SHOPIFY_STOREFRONT_API_VERSION"]?.trim() || "2026-10";
  const response = await fetchWithTimeout(`https://${domain}/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": env["SHOPIFY_STOREFRONT_TOKEN"] ?? "",
    },
    body: JSON.stringify({ query: "query ConnectorHealth { shop { name } }" }),
  });
  const body = (await readJson(response)) as
    | { data?: { shop?: { name?: unknown } | null } | null; errors?: unknown }
    | null;
  const shopName = body?.data?.shop?.name;
  if (!response.ok || typeof shopName !== "string") {
    return { ok: false, capability: "storefront_read", detail: `Shopify Storefront read failed (${response.status}).` };
  }
  return {
    ok: true,
    capability: "storefront_read",
    scope: sanitizeScope({ domain, shop: shopName }),
    detail: "Shopify Storefront read succeeded.",
  };
}

async function runReadOnlyProbe(def: ConnectorDefinition, env: ConnectorSecretEnv): Promise<ProbeResult> {
  switch (def.id) {
    case "github":
      return probeGitHub(env);
    case "slack":
      return probeSlack(env);
    case "notion":
      return probeNotion(env);
    case "linear":
      return probeLinear(env);
    case "shopify":
      return probeShopify(env);
    default:
      return { ok: false, capability: "identity_read", detail: "No read-only probe is defined for this provider." };
  }
}

export async function probeConnectorHealth(
  def: ConnectorDefinition,
  env: ConnectorSecretEnv,
  now = new Date(),
): Promise<ConnectorHealth> {
  const checkedAt = now.toISOString();
  const baseline = resolveConnectorStatus(def, envPresence(def, env));

  if (def.path === "public_web") {
    return mintHealth({
      provider: def.id,
      status: "available",
      capability: "public_source",
      scope: null,
      checkedAt,
      lastSuccess: null,
      detail: "Public and official sources require no private connector credential.",
    });
  }

  if (!isHealthProbeConfigured(def, env)) {
    const detail =
      baseline === "not_configured"
        ? "No endpoint or credential is configured."
        : baseline === "available"
          ? "Built-in AI is available, but provider callability has not been proven by this check."
          : def.authMode === "lovable_app_connector"
            ? "Managed authorization is not independently read-verifiable by this runtime yet."
            : "Required connector configuration is incomplete.";
    return mintHealth({
      provider: def.id,
      status: baseline,
      capability: def.path === "lovable_ai" ? "built_in_ai" : "configuration_only",
      scope: null,
      checkedAt,
      lastSuccess: null,
      detail,
    });
  }

  if (!READ_ONLY_PROVIDERS.has(def.id)) {
    return mintHealth({
      provider: def.id,
      status: "degraded",
      capability: def.path === "lovable_ai" ? "built_in_ai" : "configuration_only",
      scope: null,
      checkedAt,
      lastSuccess: null,
      detail:
        "Configuration is present, but this provider has no safe zero-write probe in Truth Weaver. Callability is not promoted to Connected.",
    });
  }

  try {
    const probe = await runReadOnlyProbe(def, env);
    if (!probe.ok) {
      return mintHealth({
        provider: def.id,
        status: "error",
        capability: probe.capability,
        scope: null,
        checkedAt,
        lastSuccess: null,
        detail: probe.detail,
      });
    }
    return mintHealth({
      provider: def.id,
      status: "connected",
      capability: probe.capability,
      scope: probe.scope,
      checkedAt,
      lastSuccess: checkedAt,
      detail: probe.detail,
    });
  } catch {
    return mintHealth({
      provider: def.id,
      status: "error",
      capability: def.id === "shopify" ? "storefront_read" : "identity_read",
      scope: null,
      checkedAt,
      lastSuccess: null,
      detail: "Provider probe failed before a verified read could be recorded.",
    });
  }
}
