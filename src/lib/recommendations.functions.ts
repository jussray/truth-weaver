import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { handleSchema, type RecommendationResult } from "./recommendations";

/** Public read: recommends only real, purchasable products from the store's own catalog. */
export const getRecommendations = createServerFn({ method: "POST" })
  .validator(z.object({ handle: handleSchema }))
  .handler(async ({ data }): Promise<RecommendationResult> => {
    const { recommendForHandle } = await import("./recommendations.server");
    try {
      return await recommendForHandle(data.handle);
    } catch (error) {
      console.error("Recommendations unavailable", error);
      return { mode: "none", items: [], notice: "Related items could not be loaded right now." };
    }
  });
