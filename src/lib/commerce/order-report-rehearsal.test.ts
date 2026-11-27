import { expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { toStoredAnalysis } from "../counsel-document";
import { NOTICE_AUTHORITY } from "../notice-analyzer";
import { accessOrderReport, processPaidOrder, type OrderReportPorts, type OrderReportRow } from "./order-report-processing";
import { evaluateJussPayReportProof, type StoredClaim } from "./report-order-proof";
import { SNAPSHOT_REPORT_BUCKET } from "./snapshot-report-access";

const buyer = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const analysisId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const nonce = "a".repeat(43);
const order = "gid://stripe/CheckoutSession/cs_live_inMemorySyntheticFixture";
const clock = () => new Date("2026-11-27T19:01:00.000Z");
const paid = {
  schema: "jusspay/truthweaver-paid-proof@v1", paid: true, sessionId: order.split("/").pop(),
  offerKey: "snapshot", userId: buyer, analysisId, claimNonce: nonce, amountTotalMinor: 1000,
  currency: "usd", createdAt: "2026-11-27T19:00:00.000Z",
};

it("rehearses synthetic paid proof through real PDF rendering and owner-only download without a provider or storage connection", async () => {
  let row: OrderReportRow | null = null;
  const claim: StoredClaim = { nonce, userId: buyer, analysisId, createdAt: "2026-11-27T18:55:00.000Z",
    expiresAt: "2026-11-28T18:55:00.000Z", consumedOrderGid: null };
  const key = "fixture-owner/snapshot.pdf";
  const storage = new Map<string, Uint8Array>();
  const analysis = toStoredAnalysis({
    documentTitle: "Synthetic notice",
    documentType: "Notice", issuer: "Fixture only", receivedDate: "2026-11-20",
    jurisdictionType: "state", jurisdictionDetail: "Pennsylvania",
  }, {
    criticalDeadlines: [], obligations: [], questionsForCounsel: ["What is the relevant date?"],
    uncertainties: ["No law verified."], authority: NOTICE_AUTHORITY,
    generatedAt: clock().toISOString(), model: "synthetic-fixture",
  }, clock());
  const proof = vi.fn(async () => evaluateJussPayReportProof(paid, order));
  const readOrder = vi.fn(async () => null);
  const ports: OrderReportPorts = {
    readJussPayProof: proof, readOrder, claim: async n => n === nonce ? claim : null,
    consumeClaim: async (n, gid) => {
      if (n !== nonce || (claim.consumedOrderGid && claim.consumedOrderGid !== gid)) return false;
      claim.consumedOrderGid = gid; return true;
    },
    report: async gid => gid === order ? row : null,
    insertReport: async input => { row = { ...input, createdAt: input.orderCreatedAt, status: "pending",
      storageKey: null, byteSize: null, revokedAt: null, readyAt: null }; },
    analysis: async (id, uid) => id === analysisId && uid === buyer ? analysis : null,
    newKey: () => key,
    upload: vi.fn(async (name, data) => { storage.set(name, data); return true; }),
    remove: async name => { storage.delete(name); },
    markReady: async (_gid, name, size, at) => {
      if (!row) return false; row = { ...row, status: "ready", storageKey: name, byteSize: size, readyAt: at.toISOString() }; return true;
    },
    markFailed: async () => { throw new Error("unexpected rehearsal failure"); },
  };
  const testModeOrder = "gid://stripe/CheckoutSession/cs_test_inMemorySyntheticFixture";
  expect(await processPaidOrder(testModeOrder, ports, clock)).toEqual({ state: "denied", reason: "missing_proof" });
  expect(proof).not.toHaveBeenCalled();
  expect(ports.upload).not.toHaveBeenCalled();
  proof.mockResolvedValueOnce(evaluateJussPayReportProof({ ...paid, userId: other }, order));
  expect(await processPaidOrder(order, ports, clock)).toEqual({ state: "denied", reason: "claim_mismatch" });
  expect(ports.upload).not.toHaveBeenCalled();
  expect(await processPaidOrder(order, ports, clock)).toEqual({ state: "ready", orderGid: order });
  expect(await processPaidOrder(order, ports, clock)).toEqual({ state: "ready", orderGid: order });
  expect(ports.upload).toHaveBeenCalledTimes(1);
  const download = vi.fn(async (name: string) => {
    const bytes = storage.get(name); return bytes ? new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }) : null;
  });
  const read = {
    authenticate: async (token: string) => token === "fixture-owner" ? buyer : token === "fixture-other" ? other : null,
    report: ports.report, readOrder, readJussPayProof: proof, privateBucket: async () => true,
    object: async (name: string) => storage.has(name) ?
      { bucketId: SNAPSHOT_REPORT_BUCKET, contentType: "application/pdf", size: storage.get(name)!.byteLength } : null,
    download,
  };
  expect(await accessOrderReport("fixture-other", order, read)).toEqual({ state: "not_available" });
  expect(download).not.toHaveBeenCalled();
  const accepted = await accessOrderReport("fixture-owner", order, read);
  expect(accepted.state).toBe("ready");
  if (accepted.state !== "ready") throw new Error("missing PDF");
  const bytes = Uint8Array.from(atob(accepted.base64), c => c.charCodeAt(0));
  expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  expect(JSON.stringify(accepted)).not.toContain(key);
  proof.mockResolvedValueOnce({ granted: false, reason: "missing_proof" });
  expect(await accessOrderReport("fixture-owner", order, read)).toEqual({ state: "payment_not_confirmed" });
  expect(download).toHaveBeenCalledTimes(1);
  expect(readOrder).not.toHaveBeenCalled();
});
