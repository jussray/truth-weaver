import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { toStoredAnalysis } from "./counsel-document";

import { noticeAnalyzerInputSchema } from "./notice-analyzer";

export const analyzeLegalNotice = createServerFn({ method: "POST" })
  .validator(noticeAnalyzerInputSchema)
  .handler(async ({ data }) => {
    const { analyzeLegalNoticeOnServer } = await import("./notice-analyzer.server");
    setResponseHeader("Cache-Control", "no-store");
    const response = await analyzeLegalNoticeOnServer(data);
    // Only authentic server-produced output is persisted, with an explicit opt-in Bearer token.
    const token = getRequestHeader("Authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
    if (!token) return { ...response, savedAnalysisId: null as string | null };
    const { saveAnalysisForUser } = await import("./commerce/order-reports.server");
    const savedAnalysisId = await saveAnalysisForUser(token, toStoredAnalysis(data, response));
    return { ...response, savedAnalysisId };
  });
