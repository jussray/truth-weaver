import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { ProviderId } from "./provenance";
import { CONNECTORS, resolveConnectorStatus, type ConnectorStatus } from "./registry";
import { getConnectorEnvPresence } from "./status.functions";

/** Until the server answers, every status resolves as if nothing is linked (never "Connected"). */
export function useConnectorStatuses() {
  const fetchPresence = useServerFn(getConnectorEnvPresence);
  const q = useQuery({ queryKey: ["connector-presence"], queryFn: () => fetchPresence(), staleTime: 60_000 });
  const env = q.data ?? null;
  const statuses = Object.fromEntries(
    CONNECTORS.map((c) => [c.id, resolveConnectorStatus(c, env)]),
  ) as Record<ProviderId, ConnectorStatus>;
  return { statuses, loading: q.isLoading, error: q.error };
}
