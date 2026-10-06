import { createServerFn } from "@tanstack/react-start";

import { legalNavigatorInputSchema } from "./legal-navigator";

export const researchLegalSituation = createServerFn({ method: "POST" })
  .validator(legalNavigatorInputSchema)
  .handler(async ({ data }) => {
    const { researchLegalSituationOnServer } = await import("./legal-navigator.server");
    return researchLegalSituationOnServer(data);
  });
