import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { ConnectorHealth } from "./health";
import type { ProviderId } from "./provenance";
import { CONNECTORS, type ConnectorStatus } from "./registry";
import { authed } from "@/lib/merchant/authed-call";
import { getConnectorHealth } from "./status.functions";

/**
 * Runtime connector truth. Until the server check returns, statuses are
 * Connecting. A failed health request fails closed and never synthesizes a
 * Connected state.
 */
export function useConnectorStatuses() {
  const fetchHealth = useServerFn(getConnectorHealth);
  const q = useQuery({
    queryKey: ["connector-health"],
    queryFn: () => authed(fetchHealth),
    staleTime: 60_000,
    retry: 1,
  });

  const health = Object.fromEntries((q.data ?? []).map((record) => [record.provider, record])) as Partial<
    Record<ProviderId, ConnectorHealth>
  >;

  const statuses = Object.fromEntries(
    CONNECTORS.map((connector) => {
      if (q.isLoading && !q.data) return [connector.id, "connecting"];
      if (q.error) return [connector.id, connector.path === "public_web" ? "available" : "error"];
      return [connector.id, health[connector.id]?.status ?? "error"];
    }),
  ) as Record<ProviderId, ConnectorStatus>;

  return { health, statuses, loading: q.isLoading, error: q.error };
}
