import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSignatureDataUrl, SignatureError } from "../src/lib/signature";
import { agreementInput } from "../src/lib/validation";

function png(w: number, h: number, extra = 0): string {
  const b = Buffer.alloc(33 + extra);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return "data:image/png;base64," + b.toString("base64");
}

test("accepts a well-formed PNG", () => {
  assert.equal(parseSignatureDataUrl(png(600, 200)).length, 33);
});

test("rejects non-PNG, bad base64, oversize and absurd dimensions", () => {
  assert.throws(() => parseSignatureDataUrl("data:image/svg+xml;base64,PHN2Zz4="), SignatureError);
  assert.throws(() => parseSignatureDataUrl("data:image/png;base64,@@@@"), SignatureError);
  assert.throws(() => parseSignatureDataUrl(undefined), SignatureError);
  assert.throws(() => parseSignatureDataUrl("data:image/png;base64," + Buffer.from("hello world, not a png at all!!!!!!").toString("base64")), SignatureError);
  assert.throws(() => parseSignatureDataUrl(png(600, 200, 300 * 1024)), SignatureError);
  assert.throws(() => parseSignatureDataUrl(png(100000, 200)), SignatureError);
});

test("agreement input is cleaned and validated", () => {
  const ok = agreementInput.parse({
    title: "  NDA\u0000 ",
    body: "Hi {{name}}",
    signingMode: "sequential",
    expiresAt: "2030-01-31",
    signers: [{ name: " Asha  K ", email: "ASHA@Example.com" }],
    variables: { name: "Bob\nSmith", unused: "x" },
  });
  assert.equal(ok.title, "NDA");
  assert.equal(ok.signers[0]!.email, "asha@example.com");
  assert.equal(ok.signers[0]!.name, "Asha K");
  assert.deepEqual(ok.variables, { name: "Bob Smith" });
  assert.equal(ok.expiresAt?.toISOString(), "2030-01-31T23:59:59.000Z");

  const dup = agreementInput.safeParse({
    title: "x", body: "y", signingMode: "parallel",
    signers: [{ name: "A", email: "a@x.com" }, { name: "B", email: "A@x.com" }],
  });
  assert.equal(dup.success, false);
  assert.equal(agreementInput.safeParse({ title: "x", body: "y", signingMode: "parallel", signers: [] }).success, false);
  assert.equal(agreementInput.safeParse({ title: "x", body: "y", signingMode: "parallel", expiresAt: "tomorrow", signers: [{ name: "A", email: "a@x.com" }] }).success, false);
});
