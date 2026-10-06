import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { P12Signer } from "@signpdf/signer-p12";
import { SignPdf } from "@signpdf/signpdf";
import forge from "node-forge";
import type { PDFDocument } from "pdf-lib";
import { env } from "./env";

/**
 * Digital "seal" for final PDFs: a PKCS#7 signature over the whole file made with
 * the certificate in PDF_SEAL_P12_BASE64. PDF readers report any later change.
 * A self-signed certificate (npm run make-seal-cert) proves integrity; a certificate
 * from a CA on the Adobe trust list also shows the sender's identity as trusted.
 */

export interface SealInfo {
  p12: Buffer;
  password: string;
  name: string;
  notAfter: Date;
}

let cached: SealInfo | null | undefined;

export function sealInfo(): SealInfo | null {
  if (cached !== undefined) return cached;
  const e = env();
  if (!e.PDF_SEAL_P12_BASE64) return (cached = null);
  const p12 = Buffer.from(e.PDF_SEAL_P12_BASE64.replace(/\s+/g, ""), "base64");
  const password = e.PDF_SEAL_P12_PASSWORD ?? "";
  let parsed: forge.pkcs12.Pkcs12Pfx;
  try {
    parsed = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(p12.toString("binary"))), false, password);
  } catch {
    throw new Error("PDF_SEAL_P12_BASE64 / PDF_SEAL_P12_PASSWORD: cannot open the certificate (wrong password or not a .p12 file)");
  }
  const certBag = forge.pki.oids.certBag as string;
  const bag = parsed.getBags({ bagType: certBag })[certBag]?.[0];
  if (!bag?.cert) throw new Error("PDF_SEAL_P12_BASE64: the .p12 file contains no certificate");
  const cn = bag.cert.subject.getField("CN")?.value;
  cached = { p12, password, name: typeof cn === "string" ? cn : "E-Sign document seal", notAfter: bag.cert.validity.notAfter };
  return cached;
}

/** Saves the document and signs it. The document must not be modified afterwards. */
export async function saveSealed(doc: PDFDocument, info: SealInfo, signingTime = new Date()): Promise<Uint8Array> {
  pdflibAddPlaceholder({
    pdfDoc: doc,
    reason: "Certificate of Completion - document integrity seal",
    contactInfo: env().OWNER_EMAIL,
    name: info.name,
    location: "Online",
    signingTime,
    appName: "Self-hosted E-Sign",
  });
  const unsigned = await doc.save({ useObjectStreams: false });
  const signer = new P12Signer(info.p12, { passphrase: info.password });
  // Named class import: the package is CommonJS and its default export does not survive ESM interop.
  const signed = await new SignPdf().sign(Buffer.from(unsigned), signer, signingTime);
  return new Uint8Array(signed);
}

/** Tests only. */
export function resetSealCache(): void {
  cached = undefined;
}
