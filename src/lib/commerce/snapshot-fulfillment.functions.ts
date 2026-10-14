import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { noticeAnalyzerInputSchema } from "../notice-analyzer";

/** Browser can submit a notice and order lookup, never precomputed model output or payment facts. */
export const generateMyVerifiedSnapshot = createServerFn({ method: "POST" })
  .validator(z.object({
    authAccessToken: z.string().min(1).max(8192),
    orderId: z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]*$/),
    notice: noticeAnalyzerInputSchema,
  }))
  .handler(async ({ data }) => {
    const { createOwnedSnapshotReport } = await import("./snapshot-fulfillment.server");
    return createOwnedSnapshotReport(data.authAccessToken, data.orderId, data.notice);
  });
