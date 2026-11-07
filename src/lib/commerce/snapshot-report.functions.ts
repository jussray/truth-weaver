import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

export const getMySnapshotReports = createServerFn({ method: "POST" })
  .handler(async () => {
    setResponseHeader("Cache-Control", "no-store");
    const token = getRequestHeader("Authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
    const { listOwnSnapshotReports } = await import("./snapshot-report.server");
    return listOwnSnapshotReports(token);
  });

export const downloadMySnapshotReport = createServerFn({ method: "POST" })
  .handler(async () => {
    setResponseHeader("Cache-Control", "no-store");
    const token = getRequestHeader("Authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
    const { retrieveOwnSnapshotReport } = await import("./snapshot-report.server");
    return retrieveOwnSnapshotReport(token);
  });