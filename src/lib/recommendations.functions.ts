import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { handleSchema, type RecommendationResult } from "./recommendations";

/**
 * Public read: recommends only real, purchasable products from the store's own catalog.
 * Signed-out visitors get category matches only; the metered AI ranking runs only for
 * a bearer token the server validates itself.
 */
export const getRecommendations = createServerFn({ method: "POST" })
  .validator(z.object({ handle: handleSchema }))
  .handler(async ({ data }): Promise<RecommendationResult> => {
    const { recommendForHandle } = await import("./recommendations.server");
    try {
      const token = getRequestHeader("Authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
      let allowAi = false;
      if (token && token.length <= 8192) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: user, error } = await supabaseAdmin.auth.getUser(token);
        allowAi = !error && Boolean(user.user);
      }
      return await recommendForHandle(data.handle, { allowAi });
    } catch (error) {
      console.error("Recommendations unavailable", error);
      return { mode: "none", items: [], notice: "Related items could not be loaded right now." };
    }
  });
