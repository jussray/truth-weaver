import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const analysisSchema = z.object({ analysisId: z.string().uuid() });
const orderSchema = z.object({
  orderGid: z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]*$/),
});

function bearerToken(): string {
  return getRequestHeader("Authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
}

function privateResponse() {
  setResponseHeader("Cache-Control", "no-store");
}

/** Identity-scoped, server-issued claim. The browser never invents payment proof. */
export const createMyPurchaseClaim = createServerFn({ method: "POST" })
  .validator(analysisSchema)
  .handler(async ({ data }) => {
    privateResponse();
    const { createOwnPurchaseClaim } = await import("./order-reports.server");
    return createOwnPurchaseClaim(bearerToken(), data.analysisId);
  });

export const getMyOrderReports = createServerFn({ method: "POST" })
  .handler(async () => {
    privateResponse();
    const { listOwnOrderReports } = await import("./order-reports.server");
    return listOwnOrderReports(bearerToken());
  });

export const checkMyPaidOrders = createServerFn({ method: "POST" })
  .handler(async () => {
    privateResponse();
    const { reconcileOwnOrders } = await import("./order-reports.server");
    return reconcileOwnOrders(bearerToken());
  });

/** Each download independently re-verifies the order against Shopify Admin. */
export const downloadMyOrderReport = createServerFn({ method: "POST" })
  .validator(orderSchema)
  .handler(async ({ data }) => {
    privateResponse();
    const { downloadOwnOrderReport } = await import("./order-reports.server");
    return downloadOwnOrderReport(bearerToken(), data.orderGid);
  });
