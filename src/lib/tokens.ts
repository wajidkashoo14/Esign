import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes -> 43 url-safe base64 characters (256 bits of entropy). */
export const TOKEN_BYTES = 32;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Cheap shape check so garbage input never reaches the database. */
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Constant-time comparison of two strings (hex hashes, secrets, ...). */
export function safeEqual(a: string, b: string): boolean {
  const ab = createHash("sha256").update(a, "utf8").digest();
  const bb = createHash("sha256").update(b, "utf8").digest();
  // Hashing first makes both buffers the same length, so length never leaks.
  return timingSafeEqual(ab, bb) && a.length === b.length;
}

/** Verify a presented token against a stored hash in constant time. */
export function verifyToken(token: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !isWellFormedToken(token)) return false;
  return safeEqual(hashToken(token), storedHash);
}
