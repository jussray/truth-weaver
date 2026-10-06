import { describe, expect, it } from "vitest";

import {
  compareContinuity,
  createContinuityMarker,
  fingerprintResearchEvidence,
  serializeContinuityCookie,
  type ResearchFingerprintEvidence,
} from "./continuity";

const BASE: ResearchFingerprintEvidence = {
  repo: "jussray/truth-weaver",
  branch: "main",
  codeVersion: "abc123",
  researchVersion: "legal-navigator.v1",
  normalizedQuestionHash: "qhash",
  jurisdiction: ["United States (Federal)", "Pennsylvania", "Philadelphia"],
  eventDate: null,
  asOfDate: "2026-10-06",
  sourceEvidence: [
    {
      url: "https://legis.state.pa.us/example",
      citation: "68 P.S. § 1",
      sourceType: "statute_code",
      authorityClass: "PRIMARY LAW",
      retrievedAt: "2026-10-06T06:00:00.000Z",
      currentnessEvidence: "Live official current-text source retrieved.",
    },
  ],
  findingStates: ["VERIFIED LAW"],
};

describe("Truth Weaver continuity", () => {
  it("is deterministic for the same evidence-bound state", async () => {
    expect(await fingerprintResearchEvidence(BASE)).toBe(
      await fingerprintResearchEvidence({ ...BASE }),
    );
  });

  it.each([
    ["code head", { codeVersion: "def456" }],
    ["jurisdiction", { jurisdiction: ["Nigeria"] }],
    ["as-of date", { asOfDate: "2025-01-01" }],
    [
      "source",
      {
        sourceEvidence: [
          {
            ...BASE.sourceEvidence[0],
            url: "https://www.ecfr.gov/example",
          },
        ],
      },
    ],
  ])("changes when material %s evidence changes", async (_name, patch) => {
    const before = await fingerprintResearchEvidence(BASE);
    const after = await fingerprintResearchEvidence({
      ...BASE,
      ...patch,
    } as ResearchFingerprintEvidence);
    expect(after).not.toBe(before);
  });

  it("marks predecessor evidence stale rather than false when evidence moves", async () => {
    const previous = await createContinuityMarker(BASE, {
      createdAt: "2026-10-06T06:00:00.000Z",
    });
    const current = await createContinuityMarker(
      { ...BASE, codeVersion: "def456" },
      { predecessor: previous.fingerprint, createdAt: "2026-10-06T07:00:00.000Z" },
    );

    const stale = compareContinuity(previous, current);
    expect(stale.freshness).toBe("STALE");
    expect(stale.staleReason).toContain("STALE != FALSE");
  });

  it("never grants authority and keeps sensitive text out of the cookie", async () => {
    const marker = await createContinuityMarker(BASE, {
      createdAt: "2026-10-06T06:00:00.000Z",
    });
    const cookie = decodeURIComponent(serializeContinuityCookie(marker));

    expect(marker.authority).toBe("EVIDENCE_ONLY");
    expect(marker.authorizing).toBe(false);
    expect(cookie).toContain("EVIDENCE_ONLY");
    expect(cookie).not.toContain("rent to own");
    expect(cookie).not.toContain("Philadelphia");
  });
});
