import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evidenceReviewInputSchema } from "./owner-intelligence";

async function requireMerchant(context: { userId: string; supabase: any }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "merchant",
  });
  if (error || data !== true) throw new Error("Merchant authorization required.");
}

export const getSearchConsoleSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMerchant(context);
    const { loadSearchConsoleSnapshot } = await import("./search-console.server");
    return loadSearchConsoleSnapshot();
  });

export const reviewProjectEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(evidenceReviewInputSchema.parse)
  .handler(async ({ context, data }) => {
    await requireMerchant(context);
    const { analyzeProjectEvidence } = await import("./evidence-review.server");
    return analyzeProjectEvidence(data);
  });
