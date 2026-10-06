import { createHash } from "node:crypto";
import forge from "node-forge";

/** Self-signed PKCS#12 for tests (same shape as scripts/make-seal-cert.mjs output). */
export function makeTestP12(name = "Test Seal", password = "pw"): string {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 86400_000);
  const attrs = [{ name: "commonName", value: name }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: "3des" });
  return forge.util.encode64(forge.asn1.toDer(p12).getBytes());
}

/**
 * Checks a PDF's embedded PKCS#7 signature covers the whole file except the
 * signature itself: returns true when the signed message digest equals the
 * SHA-256 of the /ByteRange bytes.
 */
export function signatureCoversFile(pdf: Uint8Array): boolean {
  const buf = Buffer.from(pdf);
  const s = buf.toString("latin1");
  const m = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(s);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number) as [number, number, number, number];
  if (a !== 0 || c + d !== buf.length) return false;
  const signed = Buffer.concat([buf.subarray(a, a + b), buf.subarray(c, c + d)]);
  const der = Buffer.from(s.slice(a + b + 1, c - 1), "hex");
  const digest = createHash("sha256").update(signed).digest();
  return der.includes(digest);
}
