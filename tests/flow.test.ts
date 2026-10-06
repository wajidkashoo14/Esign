// End-to-end tests of the agreement service against a throwaway SQLite database.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { makeTestP12, signatureCoversFile } from "./helpers";

// A brand-new database file in a fresh temp folder; migrations create the schema.
const dbDir = mkdtempSync(path.join(tmpdir(), "esign-test-"));
process.env.DATABASE_URL = `file:${path.join(dbDir, "test.db").split(path.sep).join("/")}`;
Object.assign(process.env, { NODE_ENV: "test" });
process.env.OWNER_EMAIL = "owner@example.com";
process.env.OWNER_PASSWORD_HASH = "$2b$12$" + "a".repeat(53);
process.env.AUTH_SECRET = "test-secret-".padEnd(48, "x");
for (const k of ["RESEND_API_KEY", "SMTP_HOST", "PDF_SEAL_P12_BASE64", "OWNER_TOTP_SECRET", "APP_URL"]) delete process.env[k];
process.env.SIGNER_EMAIL_OTP = "off";

execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });

const svc = await import("../src/lib/server/agreements");
const { db } = await import("../src/lib/server/db");
const { testOutbox } = await import("../src/lib/server/email");
const { resetEnvCache } = await import("../src/lib/server/env");
const { resetSealCache } = await import("../src/lib/server/seal");
const { agreementInput } = await import("../src/lib/validation");
const { sha256Hex } = await import("../src/lib/hash");

const BASE = "https://esign.test";
const client = { ip: "203.0.113.7", userAgent: "node-test" };
const PNG =
  "data:image/png;base64," +
  (() => {
    const b = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
    b.write("IHDR", 12, "ascii");
    b.writeUInt32BE(600, 16);
    b.writeUInt32BE(200, 20);
    return b.toString("base64");
  })();
const sig = { method: "typed" as const, typedName: "Signer", image: PNG };
const tokenOf = (url: string) => url.split("/sign/")[1]!;

async function draft(mode: "parallel" | "sequential", body = "Hello {{who}}, pay ₹500.", n = 2) {
  const input = agreementInput.parse({
    title: "Test agreement",
    body,
    signingMode: mode,
    signers: Array.from({ length: n }, (_, i) => ({ name: `Signer ${i + 1}`, email: `s${i + 1}@example.com` })),
    variables: { who: "World" },
  });
  return svc.createDraft(input, client);
}

const events = async (id: string) => (await db.auditEvent.findMany({ where: { agreementId: id }, orderBy: { createdAt: "asc" } })).map((e) => e.type);

before(() => resetEnvCache());
beforeEach(() => {
  testOutbox.length = 0;
});
after(async () => {
  await db.$disconnect();
  rmSync(dbDir, { recursive: true, force: true });
});

describe("parallel signing", () => {
  test("send, view, sign twice, complete with PDF and emails", async () => {
    const id = await draft("parallel");
    const links = await svc.sendAgreement(id, client, BASE);
    assert.equal(links.length, 2);
    assert.equal(testOutbox.filter((m) => m.subject.startsWith("Please sign")).length, 2);

    const a = await db.agreement.findUniqueOrThrow({ where: { id } });
    assert.equal(a.status, "sent");
    assert.equal(a.renderedBody, "Hello World, pay ₹500.");
    assert.match(a.docHash!, /^[0-9a-f]{64}$/);
    const signers = await db.signer.findMany({ where: { agreementId: id }, orderBy: { order: "asc" } });
    for (const [i, l] of links.entries()) {
      assert.notEqual(signers[i]!.tokenHash, tokenOf(l.url), "raw token is never stored");
      assert.equal(signers[i]!.tokenHash, sha256Hex(tokenOf(l.url)));
    }

    await assert.rejects(svc.updateDraft(id, agreementInput.parse({ title: "x", body: "y", signingMode: "parallel", signers: [{ name: "A", email: "a@x.io" }] })), /locked/);

    const view = await svc.loadSigningView(tokenOf(links[0]!.url), client);
    assert.equal(view.kind === "ok" && view.canSign, true);

    await svc.submitSignature(tokenOf(links[0]!.url), sig, client, BASE, { otpVerified: false });
    assert.equal((await db.agreement.findUniqueOrThrow({ where: { id } })).status, "partially_signed");
    assert.ok(testOutbox.some((m) => m.to === "owner@example.com" && m.subject.includes("signed")), "owner notified");
    await assert.rejects(svc.submitSignature(tokenOf(links[0]!.url), sig, client, BASE, { otpVerified: false }), /already signed/);

    testOutbox.length = 0;
    await svc.submitSignature(tokenOf(links[1]!.url), { ...sig, method: "drawn" }, client, BASE, { otpVerified: false });
    const done = await db.agreement.findUniqueOrThrow({ where: { id } });
    assert.equal(done.status, "completed");
    assert.ok(done.finalPdf && done.finalPdfHash === sha256Hex(done.finalPdf));
    assert.equal(done.finalPdfSealed, false);
    const completed = testOutbox.filter((m) => m.subject.startsWith("Completed"));
    assert.deepEqual(completed.map((m) => m.to).sort(), ["owner@example.com", "s1@example.com", "s2@example.com"]);
    assert.ok(completed.every((m) => m.attachments?.[0]?.content.length === done.finalPdf!.length));

    const forSigner = await svc.getSignerPdf(tokenOf(links[0]!.url));
    assert.equal(forSigner && sha256Hex(forSigner.pdf), done.finalPdfHash);
    assert.deepEqual(await events(id), ["created", "sent", "sent", "viewed", "signed", "signed", "completed"]);
  });
});

describe("sequential signing", () => {
  test("only the first signer gets a link; the next is emailed after they sign", async () => {
    const id = await draft("sequential");
    const links = await svc.sendAgreement(id, client, BASE);
    assert.deepEqual(links.map((l) => l.name), ["Signer 1"]);
    const second = await db.signer.findFirstOrThrow({ where: { agreementId: id, order: 2 } });
    await assert.rejects(svc.resendToSigner(id, second.id, client, BASE), /not this signer's turn/);

    testOutbox.length = 0;
    await svc.submitSignature(tokenOf(links[0]!.url), sig, client, BASE, { otpVerified: false });
    const next = testOutbox.find((m) => m.to === "s2@example.com" && m.action);
    assert.ok(next, "second signer emailed");
    await svc.submitSignature(tokenOf(next.action!.url), sig, client, BASE, { otpVerified: false });
    assert.equal((await db.agreement.findUniqueOrThrow({ where: { id } })).status, "completed");
  });
});

describe("resend, void, decline and expiry", () => {
  test("resend invalidates the previous link", async () => {
    const id = await draft("parallel");
    const [first] = await svc.sendAgreement(id, client, BASE);
    const [fresh] = await svc.resendToSigner(id, first!.signerId, client, BASE);
    assert.equal((await svc.loadSigningView(tokenOf(first!.url), client)).kind, "invalid");
    assert.equal((await svc.loadSigningView(tokenOf(fresh!.url), client)).kind, "ok");
  });

  test("void closes the agreement, kills links and tells signers", async () => {
    const id = await draft("parallel");
    const links = await svc.sendAgreement(id, client, BASE);
    testOutbox.length = 0;
    await svc.voidAgreement(id, "Wrong amount", client);
    assert.equal((await db.agreement.findUniqueOrThrow({ where: { id } })).status, "voided");
    assert.equal((await svc.loadSigningView(tokenOf(links[0]!.url), client)).kind, "invalid");
    await assert.rejects(svc.submitSignature(tokenOf(links[0]!.url), sig, client, BASE, { otpVerified: false }));
    assert.equal(testOutbox.filter((m) => m.subject.startsWith("Cancelled")).length, 2);
    await assert.rejects(svc.voidAgreement(id, "", client), /out for signature/);
  });

  test("decline closes the agreement and notifies the owner", async () => {
    const id = await draft("parallel");
    const links = await svc.sendAgreement(id, client, BASE);
    testOutbox.length = 0;
    await svc.declineToSign(tokenOf(links[0]!.url), "Price is wrong", client, BASE);
    const a = await db.agreement.findUniqueOrThrow({ where: { id }, include: { signers: true } });
    assert.equal(a.status, "declined");
    assert.equal(a.signers.find((s) => s.order === 1)?.declineReason, "Price is wrong");
    assert.ok(testOutbox.some((m) => m.to === "owner@example.com" && m.subject.includes("declined")));
    assert.ok(testOutbox.some((m) => m.to === "s2@example.com" && m.subject.startsWith("Cancelled")));
    await assert.rejects(svc.submitSignature(tokenOf(links[1]!.url), sig, client, BASE, { otpVerified: false }), /declined/);
    const view = await svc.loadSigningView(tokenOf(links[0]!.url), client);
    assert.equal(view.kind === "ok" && view.status, "declined");
  });

  test("expired agreements cannot be signed", async () => {
    const id = await draft("parallel");
    const links = await svc.sendAgreement(id, client, BASE);
    await db.agreement.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const view = await svc.loadSigningView(tokenOf(links[0]!.url), client);
    assert.equal(view.kind === "ok" && view.status, "expired");
    await assert.rejects(svc.submitSignature(tokenOf(links[0]!.url), sig, client, BASE, { otpVerified: false }), /expired/);
    assert.ok((await events(id)).includes("expired"));
  });
});

describe("email one-time codes", () => {
  before(() => {
    process.env.SIGNER_EMAIL_OTP = "on";
    resetEnvCache();
  });
  after(() => {
    process.env.SIGNER_EMAIL_OTP = "off";
    resetEnvCache();
  });

  test("signing requires a verified code; wrong codes are limited", async () => {
    const id = await draft("parallel", "Simple text", 1);
    const [link] = await svc.sendAgreement(id, client, BASE);
    const token = tokenOf(link!.url);
    await assert.rejects(svc.submitSignature(token, sig, client, BASE, { otpVerified: false }), /code sent to your email/);

    testOutbox.length = 0;
    const sent = await svc.requestSignerOtp(token, client);
    assert.equal(sent.maskedEmail, "s•@example.com");
    const code = testOutbox.find((m) => m.code)?.code;
    assert.match(code ?? "", /^\d{6}$/);
    const wrong = code === "000000" ? "111111" : "000000";
    await assert.rejects(svc.verifySignerOtp(token, wrong, client), /4 attempts left/);

    const ok = await svc.verifySignerOtp(token, code!, client);
    assert.equal(ok.tokenHash, sha256Hex(token));
    await assert.rejects(svc.verifySignerOtp(token, code!, client), /expired|used/, "codes are single use");

    await svc.submitSignature(token, sig, client, BASE, { otpVerified: true });
    const signer = await db.signer.findFirstOrThrow({ where: { agreementId: id } });
    assert.ok(signer.otpVerifiedAt && signer.signedAt);
    assert.deepEqual(await events(id), ["created", "sent", "otp_sent", "otp_verified", "signed", "completed"]);
  });

  test("five wrong codes lock the code", async () => {
    const id = await draft("parallel", "Simple text", 1);
    const [link] = await svc.sendAgreement(id, client, BASE);
    const token = tokenOf(link!.url);
    await svc.requestSignerOtp(token, client);
    const code = testOutbox.find((m) => m.code)!.code!;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await assert.rejects(svc.verifySignerOtp(token, wrong, client));
    await assert.rejects(svc.verifySignerOtp(token, code, client), /Too many wrong codes/);
    void id;
  });
});

describe("sealed final PDF", () => {
  test("is digitally sealed when a certificate is configured", async () => {
    process.env.PDF_SEAL_P12_BASE64 = makeTestP12("Acme Seal", "secret");
    process.env.PDF_SEAL_P12_PASSWORD = "secret";
    resetEnvCache();
    resetSealCache();
    try {
      const id = await draft("parallel", "# Terms\n\n1. **Pay** ₹1,00,000\n2. यह अनुबंध", 1);
      const [link] = await svc.sendAgreement(id, client, BASE);
      await svc.submitSignature(tokenOf(link!.url), sig, client, BASE, { otpVerified: false });
      const a = await db.agreement.findUniqueOrThrow({ where: { id } });
      assert.equal(a.finalPdfSealed, true);
      assert.ok(signatureCoversFile(a.finalPdf!));
      assert.equal(a.finalPdfHash, sha256Hex(a.finalPdf!));
    } finally {
      delete process.env.PDF_SEAL_P12_BASE64;
      delete process.env.PDF_SEAL_P12_PASSWORD;
      resetEnvCache();
      resetSealCache();
    }
  });
});
