import { createServerFn } from "@tanstack/react-start";

import { probeConnectorHealth, type ConnectorSecretEnv } from "./health";
import { allConnectorEnvNames, CONNECTORS } from "./registry";

/**
 * Runs bounded, read-only connector checks server-side and returns only
 * sanitized health facts. Secret values never cross this boundary.
 */
export const getConnectorHealth = createServerFn({ method: "GET" }).handler(async () => {
  const env: ConnectorSecretEnv = {};
  for (const name of allConnectorEnvNames()) {
    const value = process.env[name];
    env[name] = typeof value === "string" && value.length > 0 ? value : undefined;
  }

  // Optional version selector is configuration, not authentication material.
  const shopifyApiVersion = process.env["SHOPIFY_STOREFRONT_API_VERSION"];
  if (typeof shopifyApiVersion === "string" && shopifyApiVersion.length > 0) {
    env.SHOPIFY_STOREFRONT_API_VERSION = shopifyApiVersion;
  }

  const checkedAt = new Date();
  return Promise.all(CONNECTORS.map((connector) => probeConnectorHealth(connector, env, checkedAt)));
});
