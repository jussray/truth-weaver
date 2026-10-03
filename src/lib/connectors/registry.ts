import type { ProviderId } from "./provenance";

export const CONNECTOR_STATUSES = ["connected", "available", "needs_setup", "not_configured"] as const;
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];

export const CONNECTOR_STATUS_LABEL: Record<ConnectorStatus, string> = {
  connected: "Connected",
  available: "Available",
  needs_setup: "Needs setup",
  not_configured: "Not configured",
};

export type ConnectorPath =
  | "lovable_ai" // Lovable AI built-in models (no user key)
  | "standard_connector" // managed or direct connector linked to the project
  | "shopify_integration"
  | "custom_adapter" // user-supplied endpoint + secret, server-side only
  | "public_web"; // no credentials; public/official sources

export type ConnectorAuthMode =
  | "env_secret" // direct server-side credential owned by this runtime
  | "lovable_app_connector" // OAuth/app credential owned by Lovable's connector gateway
  | "none";

export type ConnectorDefinition = {
  id: ProviderId;
  name: string;
  role: string;
  path: ConnectorPath;
  authMode: ConnectorAuthMode;
  /** Server env names whose presence is required. Never read on the client. */
  requiredEnv: string[];
  /** Human authorization/setup surface. A URL is not evidence that setup completed. */
  setupUrl?: string;
  setupLabel?: string;
  consumerFacing: boolean;
  limits: string;
};

const LOVABLE_CONNECTORS_URL = "https://lovable.dev/dashboard?connectors";

export const CONNECTORS: readonly ConnectorDefinition[] = [
  {
    id: "shopify",
    name: "Shopify",
    role: "Paid tools, templates, guides and bundles.",
    path: "shopify_integration",
    authMode: "env_secret",
    requiredEnv: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_TOKEN"],
    consumerFacing: true,
    limits: "Commerce listings are never legal authority.",
  },
  {
    id: "openai",
    name: "OpenAI / ChatGPT",
    role: "Explain, compare and draft checklists.",
    path: "lovable_ai",
    authMode: "env_secret",
    requiredEnv: ["LOVABLE_API_KEY"],
    consumerFacing: true,
    limits: "Output is labelled generated / inferred unless backed by primary sources.",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    role: "Long-document summarising and comparison.",
    path: "lovable_ai",
    authMode: "env_secret",
    requiredEnv: ["LOVABLE_API_KEY"],
    consumerFacing: true,
    limits: "Output is labelled generated / inferred unless backed by primary sources.",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    role: "Careful drafting of letters and research trails.",
    path: "standard_connector",
    authMode: "env_secret",
    requiredEnv: ["ANTHROPIC_API_KEY"],
    consumerFacing: true,
    limits: "Output is labelled generated / inferred unless backed by primary sources.",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    role: "Cited web search to discover sources.",
    path: "standard_connector",
    authMode: "env_secret",
    requiredEnv: ["PERPLEXITY_API_KEY"],
    consumerFacing: true,
    limits: "Search answers are discovery only; citations must be checked against official text.",
  },
  {
    id: "muse",
    name: "Meta Muse",
    role: "Custom server-side model adapter.",
    path: "custom_adapter",
    authMode: "env_secret",
    requiredEnv: ["MUSE_ENDPOINT", "MUSE_API_KEY"],
    consumerFacing: true,
    limits: "Stays Not configured until a real endpoint and secret are supplied.",
  },
  {
    id: "exa",
    name: "Exa",
    role: "Web search, page fetch and research evidence discovery.",
    path: "custom_adapter",
    authMode: "env_secret",
    requiredEnv: ["EXA_API_KEY"],
    setupUrl: LOVABLE_CONNECTORS_URL,
    setupLabel: "Configure Exa custom adapter",
    consumerFacing: true,
    limits: "Exa supplies research evidence only. Search results never authorize provider writes or become verified law by themselves.",
  },
  {
    id: "notion",
    name: "Notion",
    role: "Knowledge, specs, continuity records and evidence packets.",
    path: "standard_connector",
    authMode: "lovable_app_connector",
    requiredEnv: [],
    setupUrl: LOVABLE_CONNECTORS_URL,
    setupLabel: "Connect Notion in Lovable",
    consumerFacing: true,
    limits: "Read and write only within explicitly granted workspace/page scopes. Host-project access is never inherited.",
  },
  {
    id: "linear",
    name: "Linear",
    role: "Issues, projects, milestones and execution-state receipts.",
    path: "standard_connector",
    authMode: "lovable_app_connector",
    requiredEnv: [],
    setupUrl: LOVABLE_CONNECTORS_URL,
    setupLabel: "Connect Linear in Lovable",
    consumerFacing: true,
    limits: "Project and issue mutations require connector-specific authority and a receipt.",
  },
  {
    id: "slack",
    name: "Slack",
    role: "Team context, messages, channels, canvases and collaboration signals.",
    path: "standard_connector",
    authMode: "lovable_app_connector",
    requiredEnv: [],
    setupUrl: LOVABLE_CONNECTORS_URL,
    setupLabel: "Connect Slack in Lovable",
    consumerFacing: true,
    limits: "Channel visibility and write actions stay bounded to granted Slack scopes; no inherited host authority.",
  },
  {
    id: "web",
    name: "Public web & official sources",
    role: "Official legislation, gazettes, courts and public pages.",
    path: "public_web",
    authMode: "none",
    requiredEnv: [],
    consumerFacing: true,
    limits: "Official text first; unofficial pages are secondary or discovery.",
  },
  {
    id: "github",
    name: "GitHub",
    role: "Optional: link a technical project you are researching.",
    path: "standard_connector",
    authMode: "env_secret",
    requiredEnv: ["GITHUB_API_KEY"],
    consumerFacing: false,
    limits: "Code is never legal evidence.",
  },
];

export type EnvPresence = Record<string, boolean>;
export type ManagedConnectorPresence = Partial<Record<ProviderId, boolean>>;

/**
 * Truthful status resolver.
 *
 * A Lovable-managed connection is never inferred from env vars. It can become
 * Connected only when a trusted runtime probe supplies managed[id] === true.
 * Until that probe exists, the UI remains Needs setup even after the user has
 * opened the OAuth surface. This intentionally prefers a stale red state over
 * a false green state.
 */
export function resolveConnectorStatus(
  def: ConnectorDefinition,
  env: EnvPresence | null,
  managed: ManagedConnectorPresence | null = null,
): ConnectorStatus {
  if (def.path === "public_web") return "available";

  if (def.authMode === "lovable_app_connector") {
    return managed?.[def.id] === true ? "connected" : "needs_setup";
  }

  const present =
    def.requiredEnv.length > 0 && env !== null && def.requiredEnv.every((name) => env[name] === true);
  if (present) return "connected";

  if (def.path === "custom_adapter") {
    return def.requiredEnv.some((name) => env?.[name]) ? "needs_setup" : "not_configured";
  }
  if (def.path === "lovable_ai") return "available";
  return "needs_setup";
}

export function allConnectorEnvNames() {
  return Array.from(new Set(CONNECTORS.flatMap((c) => c.requiredEnv)));
}
