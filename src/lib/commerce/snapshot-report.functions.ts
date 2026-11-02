import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { SNAPSHOT_ORDER_GID } from "./snapshot-report-access";

export const getMySnapshotReports = createServerFn({ method: "POST" })
  .handler(async () => {
    setResponseHeader("Cache-Control", "no-store");
    const token = getRequestHeader("Authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
    const { listOwnSnapshotReports } = await import("./snapshot-report.server");
    return listOwnSnapshotReports(token);
  });

export const downloadMySnapshotReport = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orderId: z.string().regex(SNAPSHOT_ORDER_GID) }).parse)
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const token = getRequestHeader("Authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
    const { retrieveOwnSnapshotReport } = await import("./snapshot-report.server");
    return retrieveOwnSnapshotReport(token, data.orderId);
  });