import { describe, expect, it } from "vitest";
import { issueResearchPrefill } from "./issue-research";

describe("saved issue legal navigator handoff", () => {
  it("preserves the actual issue question, place, dates and facts without claiming a finding", () => {
    expect(issueResearchPrefill({
      title: "Security deposit dispute",
      jurisdiction_note: "Philadelphia, Pennsylvania",
      event_date: "2026-10-01",
      as_of_date: "2026-10-13",
      facts: "Landlord kept the deposit.",
    })).toEqual({
      question: "Security deposit dispute",
      place: "Philadelphia, Pennsylvania",
      eventDate: "2026-10-01",
      asOfDate: "2026-10-13",
      facts: "Landlord kept the deposit.",
    });
  });

  it("does not invent a jurisdiction, date or facts when the saved issue lacks them", () => {
    expect(issueResearchPrefill({
      title: "What is the relevant law?",
      jurisdiction_note: null,
      event_date: null,
      as_of_date: null,
      facts: null,
    })).toEqual({
      question: "What is the relevant law?",
      place: "",
      eventDate: "",
      asOfDate: "",
      facts: "",
    });
  });
});
