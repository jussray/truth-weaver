import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMerchant } from "@/lib/merchant/portal.functions";

export const getSearchConsoleReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMerchant(context);
    const { readSearchConsoleSnapshot } = await import("./search-console.server");
    return readSearchConsoleSnapshot();
  });
