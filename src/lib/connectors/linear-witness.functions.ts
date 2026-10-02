import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const witnessInput = z.object({
  token: z.string().min(1).max(512),
  witnessRunId: z.string().uuid(),
});

export const getLinearWitnessReadiness = createServerFn({ method: "GET" }).handler(async () => {
  const { getLinearWitnessReadiness: getReadiness } = await import("./linear-witness.server");
  return getReadiness();
});

export const runLinearCustodyWitness = createServerFn({ method: "POST" })
  .validator(witnessInput)
  .handler(async ({ data }) => {
    const { runLinearCustodyWitness: runWitness } = await import("./linear-witness.server");
    return runWitness(data);
  });
