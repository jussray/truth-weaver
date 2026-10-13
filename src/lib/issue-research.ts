import type { Issue } from "./counsel";

/** Transfer only the owner's saved issue fields into the existing legal navigator.
 * This is initial form context, not proof of law or an authority decision.
 */
export function issueResearchPrefill(
  issue: Pick<Issue, "title" | "jurisdiction_note" | "event_date" | "as_of_date" | "facts">,
) {
  return {
    question: issue.title,
    place: issue.jurisdiction_note ?? "",
    eventDate: issue.event_date ?? "",
    asOfDate: issue.as_of_date ?? "",
    facts: issue.facts ?? "",
  };
}
