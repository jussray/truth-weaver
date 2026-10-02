import { sha256Canonical, type JsonValue } from "./custody";

export const CUSTODY_EVENT_TYPES = [
  "evidence_recorded",
  "authority_decided",
  "command_issued",
  "provider_write_attempted",
  "provider_read_back",
  "receipt_minted",
  "reconciled",
  "reconciliation_required",
  "provider_write_rejected",
] as const;

export type CustodyEventType = (typeof CUSTODY_EVENT_TYPES)[number];
export type CustodyProvider = "exa" | "notion" | "linear" | "slack";

export type CustodyEventRow = {
  id: string;
  sequence_no: number;
  correlation_id: string;
  evidence_id: string;
  event_type: CustodyEventType;
  command_id: string | null;
  authority_decision_id: string | null;
  provider: CustodyProvider | null;
  external_object_id: string | null;
  previous_event_hash: `sha256:${string}` | null;
  event_hash: `sha256:${string}`;
  payload: JsonValue;
  created_at: string;
};

export type AppendCustodyEventInput = {
  correlationId: string;
  evidenceId: string;
  eventType: CustodyEventType;
  commandId?: string | null;
  authorityDecisionId?: string | null;
  provider?: CustodyProvider | null;
  externalObjectId?: string | null;
  payload: JsonValue;
};

type SupabaseConfig = {
  url: string;
  serviceKey: string;
};

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) {
    throw new Error("custody ledger is not configured");
  }
  return { url, serviceKey };
}

function isOpaqueSupabaseKey(value: string) {
  return value.startsWith("sb_secret_") || value.startsWith("sb_publishable_");
}

function supabaseHeaders(serviceKey: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("apikey", serviceKey);
  if (!isOpaqueSupabaseKey(serviceKey)) headers.set("Authorization", `Bearer ${serviceKey}`);
  return headers;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`custody ledger request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

function eventHashBody(input: {
  correlationId: string;
  evidenceId: string;
  eventType: CustodyEventType;
  commandId: string | null;
  authorityDecisionId: string | null;
  provider: CustodyProvider | null;
  externalObjectId: string | null;
  previousEventHash: `sha256:${string}` | null;
  payload: JsonValue;
}): JsonValue {
  return {
    correlationId: input.correlationId,
    evidenceId: input.evidenceId,
    eventType: input.eventType,
    commandId: input.commandId,
    authorityDecisionId: input.authorityDecisionId,
    provider: input.provider,
    externalObjectId: input.externalObjectId,
    previousEventHash: input.previousEventHash,
    payload: input.payload,
  };
}

export async function readCustodyChain(correlationId: string): Promise<CustodyEventRow[]> {
  const { url, serviceKey } = getSupabaseConfig();
  const params = new URLSearchParams({
    correlation_id: `eq.${correlationId}`,
    select: "*",
    order: "sequence_no.asc",
  });
  const response = await fetch(`${url}/rest/v1/custody_events?${params}`, {
    headers: supabaseHeaders(serviceKey),
  });
  const rows = await readJson<CustodyEventRow[]>(response);
  await verifyCustodyChain(rows);
  return rows;
}

export async function verifyCustodyChain(rows: readonly CustodyEventRow[]) {
  let expectedPrevious: `sha256:${string}` | null = null;
  for (const row of rows) {
    if (row.previous_event_hash !== expectedPrevious) {
      throw new Error("custody ledger chain link mismatch");
    }
    const recomputed = await sha256Canonical(
      eventHashBody({
        correlationId: row.correlation_id,
        evidenceId: row.evidence_id,
        eventType: row.event_type,
        commandId: row.command_id,
        authorityDecisionId: row.authority_decision_id,
        provider: row.provider,
        externalObjectId: row.external_object_id,
        previousEventHash: row.previous_event_hash,
        payload: row.payload,
      }),
    );
    if (recomputed !== row.event_hash) throw new Error("custody ledger event hash mismatch");
    expectedPrevious = row.event_hash;
  }
}

export async function appendCustodyEvent(input: AppendCustodyEventInput): Promise<CustodyEventRow> {
  const chain = await readCustodyChain(input.correlationId);
  const previousEventHash = chain.at(-1)?.event_hash ?? null;
  const commandId = input.commandId ?? null;
  const authorityDecisionId = input.authorityDecisionId ?? null;
  const provider = input.provider ?? null;
  const externalObjectId = input.externalObjectId ?? null;
  const eventHash = await sha256Canonical(
    eventHashBody({
      correlationId: input.correlationId,
      evidenceId: input.evidenceId,
      eventType: input.eventType,
      commandId,
      authorityDecisionId,
      provider,
      externalObjectId,
      previousEventHash,
      payload: input.payload,
    }),
  );

  const { url, serviceKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/custody_events`, {
    method: "POST",
    headers: supabaseHeaders(serviceKey, {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({
      correlation_id: input.correlationId,
      evidence_id: input.evidenceId,
      event_type: input.eventType,
      command_id: commandId,
      authority_decision_id: authorityDecisionId,
      provider,
      external_object_id: externalObjectId,
      previous_event_hash: previousEventHash,
      event_hash: eventHash,
      payload: input.payload,
    }),
  });

  if (response.status === 409) {
    const current = await readCustodyChain(input.correlationId);
    const existing = current.find((row) => row.event_hash === eventHash);
    if (existing) return existing;
    throw new Error("custody ledger advanced concurrently; reconciliation required");
  }

  const inserted = await readJson<CustodyEventRow[]>(response);
  const row = inserted[0];
  if (!row) throw new Error("custody ledger insert returned no row");
  if (row.event_hash !== eventHash || row.previous_event_hash !== previousEventHash) {
    throw new Error("custody ledger insert read-back mismatch");
  }
  await verifyCustodyChain([...chain, row]);
  return row;
}
