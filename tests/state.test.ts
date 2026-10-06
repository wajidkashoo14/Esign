import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGREEMENT_STATUSES,
  assertTransition,
  canEdit,
  canSignerSign,
  canTransition,
  canVoid,
  effectiveStatus,
  nextSequentialSigners,
  statusAfterSignature,
  type SignerState,
} from "../src/lib/state";

test("legal transitions", () => {
  assert.ok(canTransition("draft", "sent"));
  assert.ok(canTransition("sent", "partially_signed"));
  assert.ok(canTransition("sent", "completed"));
  assert.ok(canTransition("partially_signed", "completed"));
  assert.ok(canTransition("partially_signed", "voided"));
  assert.ok(canTransition("sent", "expired"));
});

test("terminal states and drafts cannot jump", () => {
  for (const to of AGREEMENT_STATUSES) {
    for (const from of ["completed", "voided", "expired"] as const) assert.equal(canTransition(from, to), false);
  }
  assert.equal(canTransition("draft", "completed"), false);
  assert.equal(canTransition("draft", "voided"), false);
  assert.equal(canTransition("sent", "draft"), false);
  assert.throws(() => assertTransition("completed", "voided"));
});

test("only drafts are editable; only open agreements can be voided", () => {
  assert.equal(canEdit("draft"), true);
  for (const s of AGREEMENT_STATUSES.filter((s) => s !== "draft")) assert.equal(canEdit(s), false);
  assert.deepEqual(AGREEMENT_STATUSES.filter(canVoid), ["sent", "partially_signed"]);
});

test("effectiveStatus applies expiry to open agreements only", () => {
  const past = new Date(Date.now() - 1000);
  const future = new Date(Date.now() + 100000);
  assert.equal(effectiveStatus("sent", past), "expired");
  assert.equal(effectiveStatus("partially_signed", past), "expired");
  assert.equal(effectiveStatus("sent", future), "sent");
  assert.equal(effectiveStatus("sent", null), "sent");
  assert.equal(effectiveStatus("completed", past), "completed");
  assert.equal(effectiveStatus("draft", past), "draft");
  assert.equal(effectiveStatus("voided", past), "voided");
});

test("statusAfterSignature", () => {
  assert.equal(statusAfterSignature(1, 3), "partially_signed");
  assert.equal(statusAfterSignature(3, 3), "completed");
  assert.equal(statusAfterSignature(1, 1), "completed");
});

const mk = (id: string, order: number, signed = false): SignerState => ({ id, order, signed });

test("parallel mode lets any unsigned signer sign", () => {
  const s = [mk("a", 1), mk("b", 2), mk("c", 3, true)];
  assert.equal(canSignerSign("parallel", "b", s), true);
  assert.equal(canSignerSign("parallel", "c", s), false, "already signed");
  assert.equal(canSignerSign("parallel", "zzz", s), false);
});

test("sequential mode enforces order", () => {
  const s = [mk("a", 1), mk("b", 2), mk("c", 3)];
  assert.equal(canSignerSign("sequential", "a", s), true);
  assert.equal(canSignerSign("sequential", "b", s), false);
  const s2 = [mk("a", 1, true), mk("b", 2), mk("c", 3)];
  assert.equal(canSignerSign("sequential", "b", s2), true);
  assert.equal(canSignerSign("sequential", "c", s2), false);
  assert.deepEqual(nextSequentialSigners(s2).map((x) => x.id), ["b"]);
  assert.deepEqual(nextSequentialSigners([mk("a", 1, true)]), []);
});

test("sequential mode treats equal orders as a group", () => {
  const s = [mk("a", 1), mk("b", 1), mk("c", 2)];
  assert.equal(canSignerSign("sequential", "a", s), true);
  assert.equal(canSignerSign("sequential", "b", s), true);
  assert.equal(canSignerSign("sequential", "c", s), false);
  assert.deepEqual(nextSequentialSigners(s).map((x) => x.id), ["a", "b"]);
});
