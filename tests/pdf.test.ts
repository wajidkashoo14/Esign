import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { buildFinalPdf, createFinalPdf, type PdfInput } from "../src/lib/server/pdf";
import { sha256Hex } from "../src/lib/hash";
import { makeTestP12, signatureCoversFile } from "./helpers";

process.env.OWNER_EMAIL ??= "owner@example.com";
process.env.OWNER_PASSWORD_HASH ??= "$2b$12$" + "a".repeat(53);
process.env.AUTH_SECRET ??= "x".repeat(40);

const base: PdfInput = {
  agreementId: "agr_1",
  title: "Services ₹ Agreement – “Q4” सेवा अनुबंध",
  body:
    "# Heading\n\nLine one with **bold** and ₹50,000\n\n1. First clause\n2. Second clause\n\n- bullet\n\n---\n\n" +
    "Hindi: यह अनुबंध दोनों पक्षों के बीच है। Thai ภาษาไทย\n\nA very long token " +
    "x".repeat(300) +
    "\n\n" +
    "Para. ".repeat(900),
  docHash: sha256Hex("doc"),
  sentAt: new Date("2026-01-01T00:00:00Z"),
  completedAt: new Date("2026-01-02T00:00:00Z"),
  signers: [
    {
      name: "आशा कुमार",
      email: "a@example.com",
      order: 1,
      signedAt: new Date("2026-01-02T00:00:00Z"),
      signatureType: "typed",
      signatureName: "Asha",
      signatureImg: null,
      otpVerifiedAt: new Date("2026-01-02T00:00:00Z"),
    },
  ],
  events: [{ at: new Date("2026-01-01T00:00:00Z"), type: "otp_verified", actor: "Owner", ip: "1.2.3.4", userAgent: "UA" }],
};

/** Inflate all content streams (text is drawn with glyph ids, so only structure is checked here). */
function contentStreams(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const s = buf.toString("latin1");
  let out = "";
  let i = 0;
  while ((i = s.indexOf("stream", i)) >= 0) {
    const start = i + (s[i + 6] === "\r" ? 8 : 7);
    const end = s.indexOf("endstream", start);
    try {
      out += inflateSync(buf.subarray(start, end)).toString("latin1");
    } catch {
      /* not deflated */
    }
    i = end + 9;
  }
  return out;
}

test("final PDF embeds Unicode fonts, paginates long text and renders Devanagari", async () => {
  const bytes = await buildFinalPdf(base);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3, "body spills over to extra pages, plus certificate");
  const fontNames = doc.context
    .enumerateIndirectObjects()
    .map(([, obj]) => String(obj))
    .filter((s) => s.includes("/FontDescriptor"))
    .map((s) => /\/FontName \/(\S+)/.exec(s)?.[1] ?? "");
  assert.ok(fontNames.some((n) => n.includes("NotoSans-Regular")), "Noto Sans embedded");
  assert.ok(fontNames.some((n) => n.includes("NotoSansDevanagari")), "Noto Sans Devanagari embedded");
  assert.ok(contentStreams(bytes).includes("Tj"), "has text drawing operators");
});

test("sealed PDF carries a signature over the whole file", async () => {
  process.env.PDF_SEAL_P12_BASE64 = makeTestP12("Test Seal", "pw");
  process.env.PDF_SEAL_P12_PASSWORD = "pw";
  const { resetEnvCache } = await import("../src/lib/server/env");
  const { resetSealCache, saveSealed, sealInfo } = await import("../src/lib/server/seal");
  resetEnvCache();
  resetSealCache();
  const info = sealInfo();
  assert.equal(info?.name, "Test Seal");
  const pdf = await saveSealed(await createFinalPdf({ ...base, sealedBy: info!.name }), info!);
  assert.match(Buffer.from(pdf).toString("latin1"), /adbe\.pkcs7\.detached/);
  assert.ok(signatureCoversFile(pdf));
  const tampered = Buffer.from(pdf);
  tampered[200] = tampered[200]! ^ 1;
  assert.equal(signatureCoversFile(tampered), false, "any change breaks the digest");
  delete process.env.PDF_SEAL_P12_BASE64;
  delete process.env.PDF_SEAL_P12_PASSWORD;
  resetEnvCache();
  resetSealCache();
});
