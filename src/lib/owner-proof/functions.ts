import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { claimReviewInput, isAllowedOwner } from "./contract";

function requireOwner(userId: string): void {
  if (!isAllowedOwner(userId,process.env["TRUTH_WEAVER_OWNER_USER_IDS"]??""))
    throw new Error("Project owner authorization required.");
}

/** UX-only check; every private action repeats server-side authorization. */
export const getOwnerProofAccess=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async ({context}) => ({
    authorized:isAllowedOwner(context.userId,process.env["TRUTH_WEAVER_OWNER_USER_IDS"]??""),
  }));

export const getOwnerSearchConsole=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async ({context}) => {
    requireOwner(context.userId);
    const {readOwnerSearchConsole}=await import("./gsc.server");
    return readOwnerSearchConsole();
  });

export const reviewOwnerClaim=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .validator(claimReviewInput)
  .handler(async ({context,data}) => {
    requireOwner(context.userId);
    const {reviewClaimWithAiGateway}=await import("./gateway.server");
    return reviewClaimWithAiGateway(data);
  });
