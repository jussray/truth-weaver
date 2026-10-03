from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one anchor, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


custody = "src/lib/connectors/custody.ts"
guard = '''export async function validateAuthorizedCommandForExecution(input: {
  envelope: EvidenceEnvelope;
  decision: AuthorityDecision;
  command: AuthorizedCommand;
  requiredScope: readonly string[];
  now: string;
}): Promise<void> {
  const { envelope, decision, command } = input;
  validateAuthorityDecision({
    decision,
    envelope,
    provider: command.provider,
    operation: command.operation,
    target: command.target,
    now: input.now,
  });

  if (!command.commandId.trim()) throw new Error("command identity required");
  if (decision.authorityDecisionId !== command.authorityDecisionId) throw new Error("command authority decision mismatch");
  if (command.evidenceId !== envelope.evidenceId) throw new Error("command evidence mismatch");
  if (command.contentHash !== envelope.contentHash) throw new Error("command content hash mismatch");
  if (command.correlationId !== envelope.correlationId) throw new Error("command correlation mismatch");
  if (command.credentialRef !== decision.credentialRef) throw new Error("command credential reference mismatch");
  if (command.commandNonce !== decision.commandNonce) throw new Error("command nonce mismatch");
  if (command.issuedAt !== new Date(decision.issuedAt).toISOString()) throw new Error("command issued-at mismatch");
  if (command.expiresAt !== new Date(decision.expiresAt).toISOString()) throw new Error("command expiry mismatch");

  const targetHash = await sha256Canonical(command.target as JsonValue);
  if (command.targetHash !== targetHash) throw new Error("command target hash mismatch");

  const commandScope = normalizedScope(command.scope);
  const decisionScope = normalizedScope(decision.scope);
  if (canonicalizeJson(commandScope as unknown as JsonValue) !== canonicalizeJson(decisionScope as unknown as JsonValue)) {
    throw new Error("command scope differs from authority decision");
  }
  const requiredScope = normalizedScope(input.requiredScope);
  for (const scope of requiredScope) {
    if (!commandScope.includes(scope)) throw new Error(`command scope insufficient: ${scope}`);
  }

  const expectedIdempotencyKey = await sha256Canonical({
    evidenceId: envelope.evidenceId,
    correlationId: envelope.correlationId,
    provider: command.provider,
    operation: command.operation,
    targetHash: command.targetHash,
    authorityDecisionId: command.authorityDecisionId,
    commandNonce: command.commandNonce,
  });
  if (command.idempotencyKey !== expectedIdempotencyKey) throw new Error("command idempotency identity mismatch");
}

'''
replace_once(custody, "function assertReadBackMatchesCommand(input: {", guard + "function assertReadBackMatchesCommand(input: {")


test = "src/lib/connectors/custody.test.ts"
replace_once(test, "  createAuthorizedCommand,\n", "  createAuthorizedCommand,\n  validateAuthorizedCommandForExecution,\n")
execution_tests = '''  it("revalidates expiry and required scope immediately before provider execution", async () => {
    const { envelope, decision, command } = await fixture();
    await expect(
      validateAuthorizedCommandForExecution({
        envelope,
        decision,
        command,
        requiredScope: ["comments:create"],
        now: "2026-10-02T00:11:00Z",
      }),
    ).rejects.toThrow("authority decision expired");

    const limitedDecision: AuthorityDecision = {
      ...decision,
      authorityDecisionId: "authz_scope_limited",
      scope: ["issues:read"],
      commandNonce: "nonce_scope_limited",
    };
    const limitedCommand = await createAuthorizedCommand({
      commandId: "cmd_scope_limited",
      envelope,
      decision: limitedDecision,
      provider: "linear",
      operation: limitedDecision.operation,
      target: limitedDecision.target,
      now: "2026-10-02T00:05:00Z",
    });
    await expect(
      validateAuthorizedCommandForExecution({
        envelope,
        decision: limitedDecision,
        command: limitedCommand,
        requiredScope: ["comments:create"],
        now: "2026-10-02T00:06:00Z",
      }),
    ).rejects.toThrow("command scope insufficient: comments:create");
  });

  it("rejects tampered command binding before provider execution", async () => {
    const { envelope, decision, command } = await fixture();
    await expect(
      validateAuthorizedCommandForExecution({
        envelope,
        decision,
        command: { ...command, targetHash: "sha256:tampered" },
        requiredScope: ["comments:create"],
        now: "2026-10-02T00:06:00Z",
      }),
    ).rejects.toThrow("command target hash mismatch");

    await expect(
      validateAuthorizedCommandForExecution({
        envelope,
        decision,
        command: { ...command, idempotencyKey: "sha256:tampered" },
        requiredScope: ["comments:create"],
        now: "2026-10-02T00:06:00Z",
      }),
    ).rejects.toThrow("command idempotency identity mismatch");
  });

'''
replace_once(
    test,
    '  it("derives the same idempotency key for the same authorized attempt", async () => {',
    execution_tests + '  it("derives the same idempotency key for the same authorized attempt", async () => {',
)


witness = "src/lib/connectors/linear-witness.server.ts"
replace_once(witness, "  sha256Canonical,\n", "  sha256Canonical,\n  validateAuthorizedCommandForExecution,\n")
replace_once(
    witness,
    "function providerReadBackFromComment(comment: LinearComment, command: AuthorizedCommand): ProviderReadBack {",
    "function providerReadBackFromComment(comment: LinearComment, command: AuthorizedCommand, witnessRunId: string): ProviderReadBack {",
)
replace_once(witness, "    witness_run_id: metadata.witness_run_id,\n", "    witness_run_id: witnessRunId,\n")
replace_once(
    witness,
    "  const readBack = providerReadBackFromComment(comment, command);\n",
    "  const readBack = providerReadBackFromComment(comment, command, input.witnessRunId);\n",
)

execution_guard = '''  if (!attempt) {
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
    await appendCustodyEvent({'''
replace_once(witness, "  if (!attempt) {\n    await appendCustodyEvent({", execution_guard)

negative_validation = '''  if (negativeEvent) {
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
  if (!negativeEvent) {'''
replace_once(
    witness,
    "  if (!negativeEvent) {\n    const negative = await runNegativeZeroMutationProof",
    negative_validation + "\n    const negative = await runNegativeZeroMutationProof",
)
