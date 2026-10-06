// Creates a self-signed certificate for sealing final PDFs.
// Usage: npm run make-seal-cert -- "Your Company Name"
import { randomBytes } from "node:crypto";
import forge from "node-forge";

const name = (process.argv[2] || "E-Sign Document Seal").slice(0, 64);
const password = randomBytes(18).toString("base64url");

console.error("Generating a 3072-bit RSA key, this takes a few seconds...");
const keys = forge.pki.rsa.generateKeyPair(3072);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = "01" + randomBytes(15).toString("hex");
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
const attrs = [
  { name: "commonName", value: name },
  { name: "organizationName", value: name },
];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.setExtensions([
  { name: "basicConstraints", cA: false },
  { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
  { name: "subjectKeyIdentifier" },
]);
cert.sign(keys.privateKey, forge.md.sha256.create());

const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: "3des", friendlyName: name });
const b64 = forge.util.encode64(forge.asn1.toDer(p12).getBytes());

console.log("\nAdd these two environment variables (Vercel: Settings > Environment Variables, then redeploy):\n");
console.log(`PDF_SEAL_P12_PASSWORD=${password}`);
console.log(`PDF_SEAL_P12_BASE64=${b64}`);
console.log("\nKeep them secret: anyone with both can seal PDFs in your name.");
