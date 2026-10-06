const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const MAX_SIGNATURE_BYTES = 250 * 1024;
const PREFIX = "data:image/png;base64,";

export class SignatureError extends Error {}

/** Decode and validate a canvas PNG data URL. Throws SignatureError if it isn't a sane PNG. */
export function parseSignatureDataUrl(dataUrl: unknown): Uint8Array {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(PREFIX)) throw new SignatureError("Signature must be a PNG image.");
  const b64 = dataUrl.slice(PREFIX.length);
  if (b64.length > Math.ceil((MAX_SIGNATURE_BYTES * 4) / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new SignatureError("Signature image is invalid or too large.");
  }
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 33 || buf.length > MAX_SIGNATURE_BYTES) throw new SignatureError("Signature image is invalid or too large.");
  if (!PNG_MAGIC.every((b, i) => buf[i] === b) || buf.toString("ascii", 12, 16) !== "IHDR") {
    throw new SignatureError("Signature must be a PNG image.");
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width < 20 || height < 20 || width > 2400 || height > 1200) throw new SignatureError("Signature dimensions are out of range.");
  return new Uint8Array(buf);
}
