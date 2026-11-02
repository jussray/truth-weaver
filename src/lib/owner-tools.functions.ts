import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { claimInputSchema } from "./owner-tools.shared";

const ownerAuth = z.object({ authAccessToken: z.string().min(1).max(8192) }).strict();

export const readOwnerSearchConsole = createServerFn({ method:"POST" })
  .validator(ownerAuth)
  .handler(async ({data}) => {
    const {assertTruthWeaverOwner, getSearchConsoleOwnerReport} = await import("./owner-tools.server");
    await assertTruthWeaverOwner(data.authAccessToken);
    return getSearchConsoleOwnerReport();
  });

export const reviewOwnerEvidence = createServerFn({ method:"POST" })
  .validator(ownerAuth.extend({input:claimInputSchema}))
  .handler(async ({data}) => {
    const {assertTruthWeaverOwner, getEvidenceGateReview} = await import("./owner-tools.server");
    await assertTruthWeaverOwner(data.authAccessToken);
    return getEvidenceGateReview(data.input);
  });

/** For navigation visibility only; never substitutes for authorization on each action. */
export const getOwnerToolsAccess = createServerFn({ method:"POST" })
  .validator(ownerAuth)
  .handler(async ({data}) => {
    const {assertTruthWeaverOwner} = await import("./owner-tools.server");
    try { await assertTruthWeaverOwner(data.authAccessToken); return {authorized:true as const}; }
    catch { return {authorized:false as const}; }
  });
