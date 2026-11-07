import { describe, expect, it } from "vitest";
import { TRUTH_STATES } from "@/domain/law";
import { LEGAL_STATUS_LABELS, legalStatusLabel } from "./legal-status-labels";

describe("presentation preserves legal truth states", () => {
  it("only VERIFIED LAW can receive the verified-law label", () => {
    expect(legalStatusLabel("VERIFIED LAW")).toBe("Verified law");
    for (const state of TRUTH_STATES.filter((state) => state !== "VERIFIED LAW")) {
      expect(LEGAL_STATUS_LABELS[state]).toBeDefined();
      expect(legalStatusLabel(state)).not.toBe("Verified law");
    }
  });
  it("unknown statuses fail closed rather than suggesting verification", () => {
    expect(legalStatusLabel("NEW_STATE")).toBe("Not confirmed (NEW_STATE)");
  });
});