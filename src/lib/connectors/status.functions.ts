import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { probeConnectorHealth, type ConnectorSecretEnv } from "./health";
import { allConnectorEnvNames, CONNECTORS } from "./registry";

/**
 * Runs bounded, read-only connector checks server-side and returns only
 * sanitized health facts. Secret values never cross this boundary.
 */
export const getConnectorHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
  // Operator diagnostics: only the owner-assigned merchant role may run provider probes.
  const { data: isMerchant, error: roleError } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "merchant",
  });
  if (roleError || isMerchant !== true) throw new Error("Merchant authorization required.");

  const env: ConnectorSecretEnv = {};
  for (const name of allConnectorEnvNames()) {
    const value = process.env[name];
    env[name] = typeof value === "string" && value.length > 0 ? value : undefined;
  }

  // Optional version selector is configuration, not authentication material.
  const shopifyApiVersion = process.env["SHOPIFY_STOREFRONT_API_VERSION"];
  if (typeof shopifyApiVersion === "string" && shopifyApiVersion.length > 0) {
    env["SHOPIFY_STOREFRONT_API_VERSION"] = shopifyApiVersion;
  }

  const checkedAt = new Date();
  return Promise.all(CONNECTORS.map((connector) => probeConnectorHealth(connector, env, checkedAt)));
});
