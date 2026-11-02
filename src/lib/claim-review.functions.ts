import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMerchant } from "@/lib/merchant/portal.functions";
import { evidenceReviewInput } from "./claim-review";

export const reviewClaimEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(evidenceReviewInput.parse)
  .handler(async ({ data, context }) => {
    await assertMerchant(context);
    const { reviewClaimWithGateway } = await import("./claim-review.server");
    return reviewClaimWithGateway(data);
  });
