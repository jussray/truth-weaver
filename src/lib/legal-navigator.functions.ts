import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { legalNavigatorInputSchema } from "./legal-navigator";

/** AI + web research is metered, so it requires a validated signed-in session. */
export const researchLegalSituation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(legalNavigatorInputSchema)
  .handler(async ({ data }) => {
    const { researchLegalSituationOnServer } = await import("./legal-navigator.server");
    return researchLegalSituationOnServer(data);
  });
