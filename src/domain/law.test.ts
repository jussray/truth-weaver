import { describe, expect, it } from "vitest";

import { classifyAuthority, evaluateVerifiedLaw, isPrimaryLaw, resolveTruthState } from "./law";

const statute = {
  id: "s1",
  source_type: "statute_code",
  source_role: "primary",
  is_official: true,
  is_authentic: true,
};

const treatise = {
  id: "b1",
  source_type: "treatise",
  source_role: "secondary",
  is_official: false,
};

const guide = {
  id: "g1",
  source_type: "research_guide",
  source_role: "discovery",
  is_official: true,
};

const complete = {
  jurisdictionId: "j1",
  sources: [statute],
  citation: "1 U.S.C. § 1",
  officialStatusKnown: true,
  currentnessCheckedAt: "2026-09-01T00:00:00Z",
};

describe("authority classification", () => {
  it("treats a primary-role primary-class source as primary law", () => {
    expect(isPrimaryLaw(statute)).toBe(true);
    expect(classifyAuthority(statute)).toBe("PRIMARY LAW");
  });

  it("never treats a book or treatise as primary law", () => {
    expect(isPrimaryLaw(treatise)).toBe(false);
    expect(classifyAuthority(treatise)).toBe("SECONDARY");
  });

  it("classifies research guides as discovery only", () => {
    expect(classifyAuthority(guide)).toBe("DISCOVERY");
  });

  it("rejects a secondary class even when the role claims primary", () => {
    expect(isPrimaryLaw({ source_type: "law_review", source_role: "primary" })).toBe(false);
  });
});

describe("VERIFIED LAW guard", () => {
  it("allows VERIFIED LAW when every condition is met", () => {
    const result = evaluateVerifiedLaw(complete);
    expect(result.allowed).toBe(true);
    expect(result.resolvedState).toBe("VERIFIED LAW");
    expect(result.blockers).toEqual([]);
  });

  it("fails closed to JURISDICTION UNKNOWN when jurisdiction is unresolved", () => {
    const result = evaluateVerifiedLaw({ ...complete, jurisdictionId: null });
    expect(result.allowed).toBe(false);
    expect(result.resolvedState).toBe("JURISDICTION UNKNOWN");
  });

  it("never promotes a secondary source alone to VERIFIED LAW", () => {
    const result = evaluateVerifiedLaw({ ...complete, sources: [treatise] });
    expect(result.allowed).toBe(false);
    expect(result.resolvedState).toBe("SUPPORTED");
    expect(result.blockers).toContain("No qualifying primary-law source is attached.");
  });

  it("blocks when no source at all is attached", () => {
    const result = evaluateVerifiedLaw({ ...complete, sources: [] });
    expect(result.resolvedState).toBe("UNVERIFIED LAW");
  });

  it("blocks when the citation is missing", () => {
    const result = evaluateVerifiedLaw({ ...complete, citation: "  " });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("No citation or official identifier recorded.");
  });

  it("blocks when official / authentic status is unknown", () => {
    const result = evaluateVerifiedLaw({ ...complete, officialStatusKnown: false });
    expect(result.allowed).toBe(false);
    expect(result.resolvedState).toBe("UNVERIFIED LAW");
  });

  it("blocks when the attached primary-law source is known to be unofficial and unauthentic", () => {
    const result = evaluateVerifiedLaw({
      ...complete,
      sources: [
        {
          ...statute,
          is_official: false,
          is_authentic: false,
        },
      ],
      officialStatusKnown: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.resolvedState).toBe("UNVERIFIED LAW");
    expect(result.blockers).toContain(
      "No attached primary-law source is confirmed official or authentic.",
    );
  });

  it("blocks when currentness has not been checked", () => {
    const result = evaluateVerifiedLaw({ ...complete, currentnessCheckedAt: null });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("Currentness / as-of status has not been checked.");
  });
});

describe("resolveTruthState", () => {
  it("passes non-VERIFIED states through untouched", () => {
    const result = resolveTruthState("ALLEGED FACT", { jurisdictionId: null, sources: [] });
    expect(result.allowed).toBe(true);
    expect(result.resolvedState).toBe("ALLEGED FACT");
  });

  it("downgrades an unearned VERIFIED LAW request", () => {
    const result = resolveTruthState("VERIFIED LAW", { jurisdictionId: "j1", sources: [treatise] });
    expect(result.allowed).toBe(false);
    expect(result.resolvedState).not.toBe("VERIFIED LAW");
  });
});
