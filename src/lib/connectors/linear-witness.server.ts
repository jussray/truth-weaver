import {
  CANONICALIZATION,
  createAuthorizedCommand,
  mintEvidenceEnvelope,
  mintReceipt,
  reconcileCustody,
  sha256Canonical,
  validateAuthorizedCommandForExecution,
  type AuthorityDecision,
  type AuthorizedCommand,
  type EvidenceEnvelope,
  type JsonValue,
  type ProviderReadBack,
  type ProviderReceipt,
} from "./custody";
import {
  appendCustodyEvent,
  readCustodyChain,
  type CustodyEventRow,
} from "./custody-ledger.server";

const LINEAR_ENDPOINT = "https://api.linear.app/graphql";
const EXA_ENDPOINT = "https://api.exa.ai/search";
const ADAPTER_IDENTITY = "linear-graphql-adapter@1.0.0";
const OPERATION = "linear.issue.comment.create";
const EXA_QUERY =
  "Official Model Context Protocol authorization security considerations for token audience validation, least privilege, confused deputy protection, and token passthrough";

const EXPECTED_LINEAR_TARGET = {
  issueIdentifier: "ENG-1",
  issueUuid: "3cd5146a-9170-49e9-80bc-2b6092cc44e9",
  teamId: "dc4259d4-d6df-477c-bf44-440f32a701ef",
  projectId: "bb081bc8-ce68-4db9-b443-22ece7a4c696",
} as const;

type WitnessReadiness = {
  enabled: boolean;
  witnessTokenConfigured: boolean;
  exaConfigured: boolean;
  linearConfigured: boolean;
  ledgerConfigured: boolean;
  ready: boolean;
};

export type LinearWitnessResult =
  | {
      status: "VERIFIED_LINEAR_BRANCH";
      promotion: "BLOCKED_PENDING_REAL_PATH_AND_REMAINING_BRANCHES";
      correlationId: string;
      evidenceId: string;
      contentHash: string;
      commandId: string;
      authorityDecisionId: string;
      receiptId: string;
      receiptHash: string;
      externalObjectId: string;
      idempotencyKey: string;
      ledgerEventCount: number;
      negativeZeroMutation: true;
    }
  | {
      status: "BLOCKED" | "UNVERIFIED";
      promotion: "BLOCKED";
      reason: string;
      correlationId?: string;
      evidenceId?: string;
    };

type ExaResult = {
  id?: string;
  url?: string;
  title?: string;
  publishedDate?: string | null;
  author?: string | null;
  text?: string;
};

type ExaResponse = {
  requestId?: string;
  results?: ExaResult[];
};

type LinearComment = {
  id: string;
  body: string;
  createdAt: string;
};

type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  team: { id: string };
  project: { id: string } | null;
  comments: { nodes: LinearComment[] };
};

type LinearTargetRead = {
  issue: LinearIssue;
};

type GraphQlEnvelope<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type CommentCreateData = {
  commentCreate: {
    success: boolean;
    comment: LinearComment | null;
  };
};

type WitnessMetadata = {
  schema: "truth-os-linear-witness-v1";
  witness_run_id: string;
  evidence_id: string;
  content_hash: string;
  correlation_id: string;
  command_id: string;
  authority_decision_id: string;
  operation: string;
  target_hash: string;
  adapter_identity: string;
  idempotency_key: string;
};

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function env(name: string) {
  return process.env[name]?.trim() || null;
}

export function getLinearWitnessReadiness(): WitnessReadiness {
  const enabled = env("TRUTH_OS_WITNESS_ENABLED") === "true";
  const witnessTokenConfigured = Boolean(env("TRUTH_OS_WITNESS_TOKEN"));
  const exaConfigured = Boolean(env("EXA_API_KEY"));
  const linearConfigured = Boolean(env("LINEAR_API_KEY"));
  const ledgerConfigured = Boolean(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
  return {
    enabled,
    witnessTokenConfigured,
    exaConfigured,
    linearConfigured,
    ledgerConfigured,
    ready: enabled && witnessTokenConfigured && exaConfigured && linearConfigured && ledgerConfigured,
  };
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(bytes);
}

async function constantTimeEqual(left: string, right: string) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

async function requireWitnessPermit(token: string) {
  const readiness = getLinearWitnessReadiness();
  if (!readiness.ready) throw new Error("witness runtime is not fully configured");
  const expected = env("TRUTH_OS_WITNESS_TOKEN");
  if (!expected || !(await constantTimeEqual(token, expected))) throw new Error("witness permit rejected");
}

async function stableId(prefix: string, witnessRunId: string, purpose: string) {
  const hash = await sha256Canonical({ witnessRunId, purpose });
  return `${prefix}_${hash.slice("sha256:".length, "sha256:".length + 28)}`;
}

async function exaDiscovery() {
  const key = env("EXA_API_KEY");
  if (!key) throw new Error("Exa is not configured");
  const response = await fetch(EXA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify({
      query: EXA_QUERY,
      type: "auto",
      numResults: 5,
      contents: { text: { maxCharacters: 3000 } },
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Exa discovery failed (${response.status})`);
  const parsed = JSON.parse(text) as ExaResponse;
  const result = parsed.results?.find((candidate) => {
    if (!candidate.url) return false;
    try {
      return new URL(candidate.url).hostname === "modelcontextprotocol.io";
    } catch {
      return false;
    }
  });
  if (!result?.url) throw new Error("Exa did not return the required first-party MCP source");
  return { requestId: parsed.requestId ?? null, result };
}

async function linearGraphQl<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = env("LINEAR_API_KEY");
  if (!key) throw new Error("Linear is not configured");
  const response = await fetch(LINEAR_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  let parsed: GraphQlEnvelope<T>;
  try {
    parsed = JSON.parse(text) as GraphQlEnvelope<T>;
  } catch {
    throw new Error(`Linear returned non-JSON (${response.status})`);
  }
  if (!response.ok) throw new Error(`Linear request failed (${response.status})`);
  if (parsed.errors?.length) {
    throw new Error(`Linear GraphQL error: ${parsed.errors.map((error) => error.message ?? "unknown").join("; ")}`);
  }
  if (!parsed.data) throw new Error("Linear response contained no data");
  return parsed.data;
}

async function readLinearTarget(): Promise<LinearIssue> {
  const data = await linearGraphQl<LinearTargetRead>(
    `query WitnessTarget($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        team { id }
        project { id }
        comments { nodes { id body createdAt } }
      }
    }`,
    { id: EXPECTED_LINEAR_TARGET.issueIdentifier },
  );
  const issue = data.issue;
  if (!issue) throw new Error("Linear witness target not found");
  if (
    issue.id !== EXPECTED_LINEAR_TARGET.issueUuid ||
    issue.identifier !== EXPECTED_LINEAR_TARGET.issueIdentifier ||
    issue.team.id !== EXPECTED_LINEAR_TARGET.teamId ||
    issue.project?.id !== EXPECTED_LINEAR_TARGET.projectId
  ) {
    throw new Error("Linear witness target identity mismatch");
  }
  return issue;
}

function targetFrom(issue: LinearIssue) {
  return {
    issueId: issue.id,
    issueIdentifier: issue.identifier,
    teamId: issue.team.id,
    projectId: issue.project?.id ?? "",
  };
}

function commentMarker(commandId: string) {
  return `<!-- truth-os-custody-witness:${commandId} -->`;
}

function renderWitnessComment(witnessRunId: string, command: AuthorizedCommand) {
  const metadata: WitnessMetadata = {
    schema: "truth-os-linear-witness-v1",
    witness_run_id: witnessRunId,
    evidence_id: command.evidenceId,
    content_hash: command.contentHash,
    correlation_id: command.correlationId,
    command_id: command.commandId,
    authority_decision_id: command.authorityDecisionId,
    operation: command.operation,
    target_hash: command.targetHash,
    adapter_identity: ADAPTER_IDENTITY,
    idempotency_key: command.idempotencyKey,
  };
  return [
    "Truth OS controlled custody witness. This comment is provenance evidence for the connector verification lane.",
    "",
    commentMarker(command.commandId),
    "```json",
    JSON.stringify(metadata),
    "```",
  ].join("\n");
}

function parseWitnessMetadata(body: string): WitnessMetadata | null {
  const match = body.match(/<!-- truth-os-custody-witness:[^>]+ -->\s*```json\s*([^`]+)\s*```/s);
  if (!match?.[1]) return null;
  try {
    const value = JSON.parse(match[1]) as WitnessMetadata;
    return value.schema === "truth-os-linear-witness-v1" ? value : null;
  } catch {
    return null;
  }
}

function findWitnessComment(issue: LinearIssue, command: AuthorizedCommand) {
  const marker = commentMarker(command.commandId);
  return issue.comments.nodes.find((comment) => comment.body.includes(marker)) ?? null;
}

function providerReadBackFromComment(comment: LinearComment, command: AuthorizedCommand, witnessRunId: string): ProviderReadBack {
  const metadata = parseWitnessMetadata(comment.body);
  if (!metadata) throw new Error("Linear read-back is missing structured witness metadata");
  const expected: WitnessMetadata = {
    schema: "truth-os-linear-witness-v1",
    witness_run_id: witnessRunId,
    evidence_id: command.evidenceId,
    content_hash: command.contentHash,
    correlation_id: command.correlationId,
    command_id: command.commandId,
    authority_decision_id: command.authorityDecisionId,
    operation: command.operation,
    target_hash: command.targetHash,
    adapter_identity: ADAPTER_IDENTITY,
    idempotency_key: command.idempotencyKey,
  };
  for (const key of Object.keys(expected) as Array<keyof WitnessMetadata>) {
    if (metadata[key] !== expected[key]) throw new Error(`Linear read-back metadata mismatch: ${key}`);
  }
  return {
    externalObjectId: comment.id,
    evidenceId: command.evidenceId,
    contentHash: command.contentHash,
    correlationId: command.correlationId,
    commandId: command.commandId,
    provider: "linear",
    operation: command.operation,
    targetHash: command.targetHash,
    adapterIdentity: ADAPTER_IDENTITY,
  };
}

async function createLinearComment(issueId: string, body: string) {
  const data = await linearGraphQl<CommentCreateData>(
    `mutation WitnessCommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment { id body createdAt }
      }
    }`,
    { input: { issueId, body } },
  );
  if (!data.commentCreate.success || !data.commentCreate.comment?.id) {
    throw new Error("Linear did not confirm comment creation");
  }
  return data.commentCreate.comment;
}

function eventPayload<T>(event: CustodyEventRow | undefined, key: string): T | null {
  if (!event || typeof event.payload !== "object" || event.payload === null || Array.isArray(event.payload)) return null;
  const value = (event.payload as Record<string, JsonValue>)[key];
  return (value ?? null) as unknown as T | null;
}

async function appendBlocked(input: {
  correlationId: string;
  evidenceId: string;
  command?: AuthorizedCommand | null;
  reason: string;
}) {
  await appendCustodyEvent({
    correlationId: input.correlationId,
    evidenceId: input.evidenceId,
    eventType: "reconciliation_required",
    commandId: input.command?.commandId ?? null,
    authorityDecisionId: input.command?.authorityDecisionId ?? null,
    provider: input.command?.provider ?? null,
    payload: asJson({ reason: input.reason, promotion: "BLOCKED" }),
  });
}

async function runNegativeZeroMutationProof(input: {
  envelope: EvidenceEnvelope;
  decision: AuthorityDecision;
  issue: LinearIssue;
}) {
  const before = input.issue.comments.nodes.map((comment) => comment.id).sort();
  let rejected = false;
  try {
    await createAuthorizedCommand({
      commandId: "cmd_negative_should_never_execute",
      envelope: input.envelope,
      decision: input.decision,
      provider: "linear",
      operation: OPERATION,
      target: { ...targetFrom(input.issue), issueId: "mismatched-target" },
      now: new Date().toISOString(),
    });
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("negative authority variant was not rejected");
  const afterIssue = await readLinearTarget();
  const after = afterIssue.comments.nodes.map((comment) => comment.id).sort();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("negative authority variant changed provider state");
  return { zeroMutation: true as const, beforeCount: before.length, afterCount: after.length };
}

function resolvedResult(input: {
  envelope: EvidenceEnvelope;
  command: AuthorizedCommand;
  receipt: ProviderReceipt;
  ledgerEventCount: number;
}): LinearWitnessResult {
  return {
    status: "VERIFIED_LINEAR_BRANCH",
    promotion: "BLOCKED_PENDING_REAL_PATH_AND_REMAINING_BRANCHES",
    correlationId: input.envelope.correlationId,
    evidenceId: input.envelope.evidenceId,
    contentHash: input.envelope.contentHash,
    commandId: input.command.commandId,
    authorityDecisionId: input.command.authorityDecisionId,
    receiptId: input.receipt.receiptId,
    receiptHash: input.receipt.receiptHash,
    externalObjectId: input.receipt.externalObjectId,
    idempotencyKey: input.command.idempotencyKey,
    ledgerEventCount: input.ledgerEventCount,
    negativeZeroMutation: true,
  };
}

export async function runLinearCustodyWitness(input: {
  token: string;
  witnessRunId: string;
}): Promise<LinearWitnessResult> {
  await requireWitnessPermit(input.token);

  const correlationId = await stableId("cor", input.witnessRunId, "correlation");
  const evidenceId = await stableId("evd", input.witnessRunId, "evidence");
  let chain = await readCustodyChain(correlationId);

  const reconciliationEvent = chain.find((event) => event.event_type === "reconciliation_required");
  const evidenceEvent = chain.find((event) => event.event_type === "evidence_recorded");
  let envelope = eventPayload<EvidenceEnvelope>(evidenceEvent, "envelope");

  if (!envelope) {
    const discovery = await exaDiscovery();
    const retrievedAt = new Date().toISOString();
    const body: JsonValue = {
      kind: "research_evidence",
      witnessRunId: input.witnessRunId,
      query: EXA_QUERY,
      requestId: discovery.requestId,
      result: {
        id: discovery.result.id ?? discovery.result.url ?? null,
        url: discovery.result.url ?? null,
        title: discovery.result.title ?? null,
        publishedDate: discovery.result.publishedDate ?? null,
        author: discovery.result.author ?? null,
        text: discovery.result.text ?? null,
      },
    };
    envelope = await mintEvidenceEnvelope({
      evidenceId,
      correlationId,
      sourceReference: discovery.result.url!,
      retrievedAt,
      recordedAt: new Date().toISOString(),
      body,
    });
    await appendCustodyEvent({
      correlationId,
      evidenceId,
      eventType: "evidence_recorded",
      provider: "exa",
      payload: asJson({ envelope }),
    });
    chain = await readCustodyChain(correlationId);
  }

  const issue = await readLinearTarget();
  const target = targetFrom(issue);

  const authorityEvent = chain.find((event) => event.event_type === "authority_decided");
  let decision = eventPayload<AuthorityDecision>(authorityEvent, "decision");
  if (!decision) {
    const issued = new Date();
    decision = {
      authorityDecisionId: await stableId("authz", input.witnessRunId, "linear-authority"),
      provider: "linear",
      operation: OPERATION,
      target,
      evidenceId: envelope.evidenceId,
      correlationId: envelope.correlationId,
      scope: ["comments:create"],
      issuedAt: issued.toISOString(),
      expiresAt: new Date(issued.getTime() + 10 * 60 * 1000).toISOString(),
      commandNonce: await stableId("nonce", input.witnessRunId, "linear-command"),
      credentialRef: "credref_linear_runtime",
      status: "approved",
    };
    await appendCustodyEvent({
      correlationId,
      evidenceId: envelope.evidenceId,
      eventType: "authority_decided",
      authorityDecisionId: decision.authorityDecisionId,
      provider: "linear",
      payload: asJson({ decision }),
    });
    chain = await readCustodyChain(correlationId);
  }

  const commandEvent = chain.find((event) => event.event_type === "command_issued");
  let command = eventPayload<AuthorizedCommand>(commandEvent, "command");
  if (!command) {
    command = await createAuthorizedCommand({
      commandId: await stableId("cmd", input.witnessRunId, "linear-comment"),
      envelope,
      decision,
      provider: "linear",
      operation: OPERATION,
      target,
      now: new Date().toISOString(),
    });
    await appendCustodyEvent({
      correlationId,
      evidenceId: envelope.evidenceId,
      eventType: "command_issued",
      commandId: command.commandId,
      authorityDecisionId: command.authorityDecisionId,
      provider: "linear",
      payload: asJson({ command }),
    });
    chain = await readCustodyChain(correlationId);
  }

  const attempt = chain.find((event) => event.event_type === "provider_write_attempted");
  let providerIssue = issue;
  let comment = findWitnessComment(providerIssue, command);

  if (attempt && !comment) {
    providerIssue = await readLinearTarget();
    comment = findWitnessComment(providerIssue, command);
    if (!comment) {
      if (!reconciliationEvent) {
        await appendBlocked({
          correlationId,
          evidenceId: envelope.evidenceId,
          command,
          reason: "write was previously attempted but provider state cannot prove completion; write was not retried",
        });
      }
      return {
        status: "UNVERIFIED",
        promotion: "BLOCKED",
        reason: "provider state remains ambiguous; reconciliation required",
        correlationId,
        evidenceId: envelope.evidenceId,
      };
    }
  }

  if (!attempt) {
    try {
      await validateAuthorizedCommandForExecution({
        envelope,
        decision,
        command,
        requiredScope: ["comments:create"],
        now: new Date().toISOString(),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "provider execution authority check failed";
      await appendBlocked({ correlationId, evidenceId: envelope.evidenceId, command, reason });
      return {
        status: "BLOCKED",
        promotion: "BLOCKED",
        reason: `provider execution blocked: ${reason}`,
        correlationId,
        evidenceId: envelope.evidenceId,
      };
    }
    await appendCustodyEvent({
      correlationId,
      evidenceId: envelope.evidenceId,
      eventType: "provider_write_attempted",
      commandId: command.commandId,
      authorityDecisionId: command.authorityDecisionId,
      provider: "linear",
      payload: asJson({
        operation: command.operation,
        targetHash: command.targetHash,
        idempotencyKey: command.idempotencyKey,
      }),
    });
    try {
      await createLinearComment(issue.id, renderWitnessComment(input.witnessRunId, command));
    } catch (error) {
      providerIssue = await readLinearTarget();
      comment = findWitnessComment(providerIssue, command);
      if (!comment) {
        const reason = error instanceof Error ? error.message : "Linear write failed with unknown state";
        await appendBlocked({ correlationId, evidenceId: envelope.evidenceId, command, reason });
        return {
          status: "UNVERIFIED",
          promotion: "BLOCKED",
          reason: "Linear write outcome is ambiguous; reconciliation required",
          correlationId,
          evidenceId: envelope.evidenceId,
        };
      }
    }
  }

  providerIssue = await readLinearTarget();
  comment = findWitnessComment(providerIssue, command);
  if (!comment) {
    await appendBlocked({
      correlationId,
      evidenceId: envelope.evidenceId,
      command,
      reason: "provider read-back could not find the created comment",
    });
    return {
      status: "UNVERIFIED",
      promotion: "BLOCKED",
      reason: "provider read-back failed",
      correlationId,
      evidenceId: envelope.evidenceId,
    };
  }

  const readBack = providerReadBackFromComment(comment, command, input.witnessRunId);
  if (!chain.some((event) => event.event_type === "provider_read_back")) {
    await appendCustodyEvent({
      correlationId,
      evidenceId: envelope.evidenceId,
      eventType: "provider_read_back",
      commandId: command.commandId,
      authorityDecisionId: command.authorityDecisionId,
      provider: "linear",
      externalObjectId: comment.id,
      payload: asJson({ readBack, providerCreatedAt: comment.createdAt }),
    });
    chain = await readCustodyChain(correlationId);
  }

  const receiptEvent = chain.find((event) => event.event_type === "receipt_minted");
  let receipt = eventPayload<ProviderReceipt>(receiptEvent, "receipt");
  if (!receipt) {
    receipt = await mintReceipt({
      receiptId: await stableId("rcpt", input.witnessRunId, "linear-receipt"),
      command,
      readBack,
      adapterIdentity: ADAPTER_IDENTITY,
      externalObjectId: comment.id,
      providerTimestamp: comment.createdAt,
      readBackVerifiedAt: new Date().toISOString(),
    });
    await appendCustodyEvent({
      correlationId,
      evidenceId: envelope.evidenceId,
      eventType: "receipt_minted",
      commandId: command.commandId,
      authorityDecisionId: command.authorityDecisionId,
      provider: "linear",
      externalObjectId: comment.id,
      payload: asJson({ receipt }),
    });
    chain = await readCustodyChain(correlationId);
  }

  const reconciliation = await reconcileCustody({ envelope, decision, command, receipt, readBack });
  if (reconciliation.status !== "VERIFIED") {
    await appendBlocked({
      correlationId,
      evidenceId: envelope.evidenceId,
      command,
      reason: reconciliation.reason,
    });
    return {
      status: "UNVERIFIED",
      promotion: "BLOCKED",
      reason: reconciliation.reason,
      correlationId,
      evidenceId: envelope.evidenceId,
    };
  }

  if (!chain.some((event) => event.event_type === "reconciled")) {
    await appendCustodyEvent({
      correlationId,
      evidenceId: envelope.evidenceId,
      eventType: "reconciled",
      commandId: command.commandId,
      authorityDecisionId: command.authorityDecisionId,
      provider: "linear",
      externalObjectId: comment.id,
      payload: asJson({ reconciliation, receiptHash: receipt.receiptHash }),
    });
  }

  const negativeEvent = (await readCustodyChain(correlationId)).find(
    (event) => event.event_type === "provider_write_rejected",
  );
  if (negativeEvent) {
    const kind = eventPayload<string>(negativeEvent, "kind");
    const mismatch = eventPayload<string>(negativeEvent, "mismatch");
    const zeroMutation = eventPayload<boolean>(negativeEvent, "zeroMutation");
    if (kind !== "negative_authority_test" || mismatch !== "target" || zeroMutation !== true) {
      const reason = "stored negative authorization proof is incomplete or mismatched";
      await appendBlocked({ correlationId, evidenceId: envelope.evidenceId, command, reason });
      return {
        status: "UNVERIFIED",
        promotion: "BLOCKED",
        reason,
        correlationId,
        evidenceId: envelope.evidenceId,
      };
    }
  }
  if (!negativeEvent) {
    const negative = await runNegativeZeroMutationProof({ envelope, decision, issue: await readLinearTarget() });
    await appendCustodyEvent({
      correlationId,
      evidenceId: envelope.evidenceId,
      eventType: "provider_write_rejected",
      commandId: command.commandId,
      authorityDecisionId: command.authorityDecisionId,
      provider: "linear",
      externalObjectId: comment.id,
      payload: asJson({
        kind: "negative_authority_test",
        mismatch: "target",
        zeroMutation: negative.zeroMutation,
        beforeCount: negative.beforeCount,
        afterCount: negative.afterCount,
      }),
    });
  }

  const finalChain = await readCustodyChain(correlationId);
  return resolvedResult({ envelope, command, receipt, ledgerEventCount: finalChain.length });
}
