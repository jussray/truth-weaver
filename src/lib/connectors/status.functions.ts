import { createServerFn } from "@tanstack/react-start";

import { allConnectorEnvNames } from "./registry";

/** Returns only booleans: which connector credentials exist server-side. No values. */
export const getConnectorEnvPresence = createServerFn({ method: "GET" }).handler(async () => {
  const presence: Record<string, boolean> = {};
  for (const name of allConnectorEnvNames()) {
    const value = process.env[name];
    presence[name] = typeof value === "string" && value.length > 0;
  }
  return presence;
});
