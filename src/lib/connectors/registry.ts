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
  | "standard_connector" // provider credential/configuration supplied server-side
  | "shopify_integration"
  | "custom_adapter" // user-supplied endpoint + secret, server-side only
  | "public_web"; // no credentials; public/official sources

export type ConnectorDefinition = {
  id: ProviderId;
  name: string;
  role: string;
  path: ConnectorPath;
  /** Server env names whose presence is required. Never read on the client. */
  requiredEnv: string[];
  consumerFacing: boolean;
  limits: string;
};

export const CONNECTORS: readonly ConnectorDefinition[] = [
  {
    id: "shopify",
    name: "Shopify",
    role: "Paid tools, templates, guides and bundles.",
    path: "shopify_integration",
    requiredEnv: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_TOKEN"],
    consumerFacing: true,
    limits: "Commerce listings are never legal authority.",
  },
  {
    id: "openai",
    name: "OpenAI / ChatGPT",
    role: "Explain, compare and draft checklists.",
    path: "lovable_ai",
    requiredEnv: ["LOVABLE_API_KEY"],
    consumerFacing: true,
    limits: "Output is labelled generated / inferred unless backed by primary sources.",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    role: "Long-document summarising and comparison.",
    path: "lovable_ai",
    requiredEnv: ["LOVABLE_API_KEY"],
    consumerFacing: true,
    limits: "Output is labelled generated / inferred unless backed by primary sources.",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    role: "Careful drafting of letters and research trails.",
    path: "standard_connector",
    requiredEnv: ["ANTHROPIC_API_KEY"],
    consumerFacing: true,
    limits: "Output is labelled generated / inferred unless backed by primary sources.",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    role: "Cited web search to discover sources.",
    path: "standard_connector",
    requiredEnv: ["PERPLEXITY_API_KEY"],
    consumerFacing: true,
    limits: "Search answers are discovery only; citations must be checked against official text.",
  },
  {
    id: "muse",
    name: "Meta Muse",
    role: "Custom server-side model adapter.",
    path: "custom_adapter",
    requiredEnv: ["MUSE_ENDPOINT", "MUSE_API_KEY"],
    consumerFacing: true,
    limits: "Stays Not configured until a real endpoint and secret are supplied.",
  },
  {
    id: "exa",
    name: "Exa",
    role: "Web search, page fetch and research evidence discovery.",
    path: "custom_adapter",
    requiredEnv: ["EXA_API_KEY"],
    consumerFacing: true,
    limits: "Exa supplies research evidence only. Search results never authorize provider writes or become verified law by themselves.",
  },
  {
    id: "notion",
    name: "Notion",
    role: "Knowledge, specs, continuity records and evidence packets.",
    path: "standard_connector",
    requiredEnv: ["NOTION_API_KEY"],
    consumerFacing: true,
    limits: "Read and write only within explicitly granted workspace/page scopes. Host-project access is never inherited.",
  },
  {
    id: "linear",
    name: "Linear",
    role: "Issues, projects, milestones and execution-state receipts.",
    path: "standard_connector",
    requiredEnv: ["LINEAR_API_KEY"],
    consumerFacing: true,
    limits: "Project and issue mutations require connector-specific authority and a receipt.",
  },
  {
    id: "slack",
    name: "Slack",
    role: "Team context, messages, channels, canvases and collaboration signals.",
    path: "standard_connector",
    requiredEnv: ["SLACK_BOT_TOKEN"],
    consumerFacing: true,
    limits: "Channel visibility and write actions stay bounded to granted Slack scopes; no inherited host authority.",
  },
  {
    id: "web",
    name: "Public web & official sources",
    role: "Official legislation, gazettes, courts and public pages.",
    path: "public_web",
    requiredEnv: [],
    consumerFacing: true,
    limits: "Official text first; unofficial pages are secondary or discovery.",
  },
  {
    id: "github",
    name: "GitHub",
    role: "Optional: link a technical project you are researching.",
    path: "standard_connector",
    requiredEnv: ["GITHUB_API_KEY"],
    consumerFacing: false,
    limits:
      "Code is not governing legal authority. Repository content may serve as evidence only when its provenance, relevance, and authenticity are established.",
  },
];

export type EnvPresence = Record<string, boolean>;

/**
 * Configuration-only baseline. This function deliberately cannot return
 * `connected`: credential presence is configuration evidence, not provider
 * callability evidence. A server-side provider probe must promote a connector
 * to Connected for the current check.
 */
export function resolveConnectorStatus(def: ConnectorDefinition, env: EnvPresence | null): ConnectorStatus {
  if (def.path === "public_web") return "available";

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
  return Array.from(new Set(CONNECTORS.flatMap((c) => c.requiredEnv)));
}
