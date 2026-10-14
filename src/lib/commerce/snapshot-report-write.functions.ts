import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { noticeAnalyzerInputSchema } from "../notice-analyzer";

/**
 * Buyer can supply their notice text, consent, and order lookup key, but never
 * a customer ID, payment decision, entitlement or private storage location.
 */
export const generateMySnapshotReport = createServerFn({ method: "POST" })
  .validator(z.object({
    authAccessToken: z.string().min(1).max(8192),
    orderId: z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]*$/),
    notice: noticeAnalyzerInputSchema,
    consentToAiProcessing: z.literal(true),
  }))
  .handler(async ({ data }) => {
    const { createVerifiedSnapshotReport } = await import("./snapshot-report-write.server");
    return createVerifiedSnapshotReport(data.authAccessToken, data.orderId, data.notice);
  });
