import { createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "./tokens";

// RFC 6238 time-based one-time passwords (Google Authenticator, Authy, 1Password, ...).

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  if (!/^[A-Z2-7]+$/.test(clean)) throw new Error("Invalid base32 secret");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function isValidTotpSecret(secret: string): boolean {
  try {
    return base32Decode(secret).length >= 10;
  } catch {
    return false;
  }
}

/** 160-bit secret, as recommended by RFC 4226. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(key: Uint8Array, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(msg).digest();
  const off = h[h.length - 1]! & 0x0f;
  const bin = ((h[off]! & 0x7f) << 24) | (h[off + 1]! << 16) | (h[off + 2]! << 8) | h[off + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const totpCounter = (nowMs = Date.now(), stepSec = 30) => Math.floor(nowMs / 1000 / stepSec);

/**
 * Returns the matching time-step counter (so callers can reject replays), or null.
 * Accepts the previous and next step to allow for clock drift.
 */
export function verifyTotp(secret: string, code: string, nowMs = Date.now(), window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return null;
  }
  const now = totpCounter(nowMs);
  let match: number | null = null;
  for (let c = now - window; c <= now + window; c++) {
    if (safeEqual(hotp(key, c), code)) match = c; // no early exit: constant work
  }
  return match;
}

export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${q.toString()}`;
}
