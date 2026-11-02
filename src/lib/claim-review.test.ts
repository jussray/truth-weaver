import { describe, expect, it } from "vitest";
import { evidenceReviewInput, parseEvidenceReview } from "./claim-review";

describe("claim review gate", () => {
  const input = { claim: "This source proves our announcement is correct.", evidence: [{ label: "Primary document", detail: "The source describes the announced feature but not production behavior." }], consent: true };
  it("requires explicit transfer consent and bounded evidence", () => {
    expect(evidenceReviewInput.safeParse(input).success).toBe(true);
    expect(evidenceReviewInput.safeParse({ ...input, consent: false }).success).toBe(false);
    expect(evidenceReviewInput.safeParse({ ...input, evidence: [] }).success).toBe(false);
    expect(evidenceReviewInput.safeParse({ ...input, evidence: [ ...Array(7).fill(input.evidence[0]) ] }).success).toBe(false);
    expect(evidenceReviewInput.safeParse({ ...input, extra: "secret" }).success).toBe(false);
  });
  it("can only propose review gates, never approve publishing or legal truth", () => {
    const base = { gaps: [], attackQuestions: ["Could this have changed?"], nextGate: "human-review", gateReason: "Requires independent proof before a decision." };
    expect(parseEvidenceReview(JSON.stringify(base)).nextGate).toBe("human-review");
    expect(() => parseEvidenceReview(JSON.stringify({ ...base, nextGate: "publish" }))).toThrow();
    expect(() => parseEvidenceReview(JSON.stringify({ ...base, status: "VERIFIED" }))).toThrow();
  });
});