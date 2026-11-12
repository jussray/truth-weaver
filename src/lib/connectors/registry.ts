import type { ProviderId } from "./provenance";

export const CONNECTOR_STATUSES = [
  "connected",
  "available",
  "needs_setup",
  "connecting",
  "degraded",
  "error",
  "not_configured",
] as const;
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];

export const CONNECTOR_STATUS_LABEL: Record<ConnectorStatus, string> = {
  connected: "Connected",
  available: "Available",
  needs_setup: "Needs setup",
  connecting: "Connecting",
  degraded: "Degraded",
  error: "Error",
  not_configured: "Not configured",
};

export type ConnectorPath =
  | "lovable_ai" // Lovable AI built-in models (no user key required for availability)
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
  /** Server env names required for the configured auth path. Never read on the client. */
  requiredEnv: string[];
  /** Optional server-only credentials used only for bounded read-proof health checks. */
  healthProbeEnv?: string[];
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
    healthProbeEnv: ["NOTION_API_KEY"],
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
    healthProbeEnv: ["LINEAR_API_KEY"],
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
    healthProbeEnv: ["SLACK_BOT_TOKEN"],
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
    id: "x",
    name: "X (formerly Twitter)",
    role: "Official communications, real-time public updates, and social statements.",
    path: "standard_connector",
    authMode: "lovable_app_connector",
    requiredEnv: [],
    healthProbeEnv: ["X_BEARER_TOKEN", "TWITTER_BEARER_TOKEN"],
    setupUrl: LOVABLE_CONNECTORS_URL,
    setupLabel: "Connect X in Lovable",
    consumerFacing: true,
    limits: "Social statements and posts are discovery or public claims only; never governing legal authority.",
  },
  {
    id: "github",
    name: "GitHub",
    role: "Optional: link a technical project you are researching.",
    path: "standard_connector",
    authMode: "env_secret",
    requiredEnv: ["GITHUB_API_KEY"],
    consumerFacing: false,
    limits:
      "Code is not governing legal authority. Repository content may serve as evidence only when its provenance, relevance, and authenticity are established.",
  },
];

export type EnvPresence = Record<string, boolean>;
export type ManagedConnectorPresence = Partial<Record<ProviderId, boolean>>;

/**
 * Configuration-only baseline. This function deliberately cannot return
 * `connected`: credential presence or managed-link presence is configuration
 * evidence, not provider callability evidence. A successful server-side
 * provider read must promote a connector to Connected for the current check.
 */
export function resolveConnectorStatus(
  def: ConnectorDefinition,
  env: EnvPresence | null,
  managed: ManagedConnectorPresence | null = null,
): ConnectorStatus {
  if (def.path === "public_web") return "available";

  if (def.authMode === "lovable_app_connector") {
    return managed?.[def.id] === true ? "degraded" : "needs_setup";
  }

  const anyPresent = def.requiredEnv.some((name) => env?.[name] === true);
  const fullyPresent =
    env !== null && def.requiredEnv.length > 0 && def.requiredEnv.every((name) => env[name] === true);

  if (def.path === "custom_adapter") {
    if (!anyPresent) return "not_configured";
    return fullyPresent ? "degraded" : "needs_setup";
  }

  if (def.path === "lovable_ai") {
    return fullyPresent ? "degraded" : "available";
  }

  return fullyPresent ? "degraded" : "needs_setup";
}

export function allConnectorEnvNames() {
  return Array.from(new Set(CONNECTORS.flatMap((c) => [...c.requiredEnv, ...(c.healthProbeEnv ?? [])])));
}
