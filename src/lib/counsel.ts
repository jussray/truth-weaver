import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { evaluateVerifiedLaw, isPrimaryLaw, type TruthState } from "@/domain/law";

type Tables = Database["public"]["Tables"];
export type Jurisdiction = Tables["jurisdictions"]["Row"];
export type LegalSource = Tables["legal_sources"]["Row"];
export type LegalBook = Tables["legal_books"]["Row"];
export type Issue = Tables["issues"]["Row"];
export type Finding = Tables["findings"]["Row"];
export type IssueElement = Tables["issue_elements"]["Row"];
export type RemedyDefense = Tables["remedies_defenses"]["Row"];
export type RedTeamCheck = Tables["red_team_checks"]["Row"];
export type ResearchLogEntry = Tables["research_log"]["Row"];

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listJurisdictions() {
  return unwrap(await supabase.from("jurisdictions").select("*").order("layer").order("name"));
}

export async function listSources() {
  return unwrap(await supabase.from("legal_sources").select("*").order("source_role").order("name"));
}

export async function listBooks() {
  return unwrap(await supabase.from("legal_books").select("*").order("title"));
}

export async function listIssues() {
  return unwrap(await supabase.from("issues").select("*").order("created_at", { ascending: false }));
}

export async function getIssue(id: string): Promise<Issue | null> {
  const { data, error } = await supabase.from("issues").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Issue | null;
}

export async function createIssue(input: Omit<Tables["issues"]["Insert"], "user_id">): Promise<Issue> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to create a matter.");
  const { data, error } = await supabase
    .from("issues")
    .insert({ ...input, user_id: auth.user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Issue was not saved.");
  return data as Issue;
}

export async function updateIssue(id: string, patch: Tables["issues"]["Update"]) {
  return unwrap(await supabase.from("issues").update(patch).eq("id", id).select().single());
}

export async function listFindings(issueId: string) {
  return unwrap(
    await supabase.from("findings").select("*").eq("issue_id", issueId).order("created_at"),
  );
}

export type FindingDraft = {
  issue_id: string;
  proposition: string;
  requested_state: TruthState;
  reasoning_summary: string | null;
  jurisdiction_id: string | null;
  source_ids: string[];
  contrary_source_ids: string[];
  citation: string | null;
  official_status_known: boolean;
  currentness_checked: boolean;
};

/**
 * Application-side enforcement of the VERIFIED LAW rule. A finding is stored
 * with the state the guard allows, never the state the user asked for.
 */
export function guardFinding(draft: FindingDraft, sources: LegalSource[]) {
  const attached = sources.filter((s) => draft.source_ids.includes(s.id));
  const currentnessCheckedAt = draft.currentness_checked ? new Date().toISOString() : null;
  const result = evaluateVerifiedLaw({
    jurisdictionId: draft.jurisdiction_id,
    sources: attached,
    citation: draft.citation,
    officialStatusKnown: draft.official_status_known,
    currentnessCheckedAt,
  });
  return { result, attached, currentnessCheckedAt };
}

export async function createFinding(draft: FindingDraft, sources: LegalSource[]) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to record a finding.");

  const { result, currentnessCheckedAt } = guardFinding(draft, sources);
  const truth_state =
    draft.requested_state === "VERIFIED LAW" ? result.resolvedState : draft.requested_state;

  const row = unwrap(
    await supabase
      .from("findings")
      .insert({
        user_id: auth.user.id,
        issue_id: draft.issue_id,
        proposition: draft.proposition,
        truth_state,
        reasoning_summary: draft.reasoning_summary,
        jurisdiction_id: draft.jurisdiction_id,
        source_ids: draft.source_ids,
        contrary_source_ids: draft.contrary_source_ids,
        citation: draft.citation,
        verified_at: truth_state === "VERIFIED LAW" ? new Date().toISOString() : null,
        currentness_checked_at: currentnessCheckedAt,
      })
      .select()
      .single(),
  );

  return { row, blocked: draft.requested_state === "VERIFIED LAW" && !result.allowed, blockers: result.blockers };
}

export async function deleteFinding(id: string) {
  const { error } = await supabase.from("findings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listElements(issueId: string) {
  return unwrap(
    await supabase.from("issue_elements").select("*").eq("issue_id", issueId).order("created_at"),
  );
}

export async function createElement(input: Omit<Tables["issue_elements"]["Insert"], "user_id">) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  return unwrap(
    await supabase.from("issue_elements").insert({ ...input, user_id: auth.user.id }).select().single(),
  );
}

export async function listRemedies(issueId: string) {
  return unwrap(
    await supabase.from("remedies_defenses").select("*").eq("issue_id", issueId).order("created_at"),
  );
}

export async function createRemedy(input: Omit<Tables["remedies_defenses"]["Insert"], "user_id">) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  return unwrap(
    await supabase.from("remedies_defenses").insert({ ...input, user_id: auth.user.id }).select().single(),
  );
}

export async function listIssueSources(issueId: string) {
  return unwrap(
    await supabase
      .from("issue_sources")
      .select("id, source_id, relevance_note, legal_sources(*)")
      .eq("issue_id", issueId),
  );
}

export async function attachSource(issueId: string, sourceId: string, note: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  const { error } = await supabase
    .from("issue_sources")
    .upsert(
      { issue_id: issueId, source_id: sourceId, relevance_note: note, user_id: auth.user.id },
      { onConflict: "issue_id,source_id" },
    );
  if (error) throw new Error(error.message);
}

export async function detachSource(id: string) {
  const { error } = await supabase.from("issue_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listIssueBooks(issueId: string) {
  return unwrap(
    await supabase
      .from("issue_books")
      .select("id, book_id, relevance_note, legal_books(*)")
      .eq("issue_id", issueId),
  );
}

export async function attachBook(issueId: string, bookId: string, note: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  const { error } = await supabase
    .from("issue_books")
    .upsert(
      { issue_id: issueId, book_id: bookId, relevance_note: note, user_id: auth.user.id },
      { onConflict: "issue_id,book_id" },
    );
  if (error) throw new Error(error.message);
}

export async function detachBook(id: string) {
  const { error } = await supabase.from("issue_books").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listRedTeam(issueId: string) {
  return unwrap(
    await supabase.from("red_team_checks").select("*").eq("issue_id", issueId).order("created_at"),
  );
}

export async function createRedTeamChecklist(
  issueId: string,
  items: ReadonlyArray<{ category: string; prompt: string }>,
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  const { error } = await supabase.from("red_team_checks").insert(
    items.map((item) => ({
      issue_id: issueId,
      user_id: auth.user!.id,
      category: item.category,
      prompt: item.prompt,
      response: null,
      status: "pending_research",
    })),
  );
  if (error) throw new Error(error.message);
}

export async function answerRedTeam(id: string, response: string) {
  const { error } = await supabase
    .from("red_team_checks")
    .update({ response, status: response.trim() ? "answered_by_human" : "pending_research" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listResearchLog(issueId: string) {
  return unwrap(
    await supabase
      .from("research_log")
      .select("*")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: false }),
  );
}

export async function addResearchLog(issueId: string, entry: string, entryType = "note") {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  const { error } = await supabase
    .from("research_log")
    .insert({ issue_id: issueId, user_id: auth.user.id, entry, entry_type: entryType });
  if (error) throw new Error(error.message);
}

export function primarySourcesOf(sources: LegalSource[]) {
  return sources.filter(isPrimaryLaw);
}
