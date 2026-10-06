import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { buildFinalPdf } from "../src/lib/server/pdf";
import { sha256Hex } from "../src/lib/hash";

const base = {
  agreementId: "agr_1",
  title: "Services ₹ Agreement – “Q4”",
  body: "Line one\n\nLine two with Hindi नमस्ते and a very long token " + "x".repeat(300) + "\n" + "Para. ".repeat(900),
  docHash: sha256Hex("doc"),
  sentAt: new Date("2026-01-01T00:00:00Z"),
  completedAt: new Date("2026-01-02T00:00:00Z"),
  signers: [
    { name: "A", email: "a@example.com", order: 1, signedAt: new Date("2026-01-02T00:00:00Z"), signatureType: "typed", signatureName: "A", signatureImg: null },
  ],
  events: [{ at: new Date("2026-01-01T00:00:00Z"), type: "sent", actor: "Owner", ip: "1.2.3.4", userAgent: "UA" }],
};

test("final PDF builds, paginates long text, and survives non-Latin characters", async () => {
  const bytes = await buildFinalPdf(base);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3, "body spills over to extra pages, plus certificate");
  assert.match(sha256Hex(bytes), /^[0-9a-f]{64}$/);
});
