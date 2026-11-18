import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toStoredAnalysis } from "./counsel-document";
import { noticeAnalyzerInputSchema } from "./notice-analyzer";

const analyzeInputSchema = z.object({
  notice: noticeAnalyzerInputSchema,
  saveForReport: z.boolean().default(false),
});

/** AI analysis is metered, so it requires a validated signed-in session. Saving stays opt-in. */
export const analyzeLegalNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(analyzeInputSchema)
  .handler(async ({ data }) => {
    const { analyzeLegalNoticeOnServer } = await import("./notice-analyzer.server");
    setResponseHeader("Cache-Control", "no-store");
    const response = await analyzeLegalNoticeOnServer(data.notice);
    if (!data.saveForReport) return { ...response, savedAnalysisId: null as string | null };
    const token = getRequestHeader("Authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
    const { saveAnalysisForUser } = await import("./commerce/order-reports.server");
    const savedAnalysisId = await saveAnalysisForUser(token, toStoredAnalysis(data.notice, response));
    return { ...response, savedAnalysisId };
  });
