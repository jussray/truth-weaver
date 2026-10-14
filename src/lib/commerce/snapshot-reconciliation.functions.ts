import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** User can request a check, not assert a Shopify customer, order or payment. */
export const checkMySnapshotPurchases = createServerFn({ method: "POST" })
  .validator(z.object({ authAccessToken: z.string().min(1).max(8192) }))
  .handler(async ({ data }) => {
    const { reconcileOwnSnapshotPurchases } = await import("./snapshot-reconciliation.server");
    return reconcileOwnSnapshotPurchases(data.authAccessToken);
  });
