import { createHash } from "node:crypto";

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Canonical document hash, recorded when the agreement is sent.
 * Hash input is the UTF-8 JSON encoding of {"v":1,"title":...,"body":...}
 * where body is the text with all {{variables}} substituted.
 */
export function documentHash(title: string, renderedBody: string): string {
  return sha256Hex(JSON.stringify({ v: 1, title, body: renderedBody }));
}
