import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Browser supplies a bearer session and order lookup ID, not customer/payment proof. */
export const requestSnapshotDownload = createServerFn({ method: "POST" })
  .validator(z.object({
    authAccessToken: z.string().min(1).max(8192),
    orderId: z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]*$/),
  }))
  .handler(async ({ data }) => {
    const { getVerifiedSnapshotDownload } = await import("./snapshot-download.server");
    return getVerifiedSnapshotDownload(data.authAccessToken, data.orderId);
  });
