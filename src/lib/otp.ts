import { createHmac, randomInt } from "node:crypto";
import { safeEqual } from "./tokens";

// One-time codes emailed to a signer to confirm they control the invited address.

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
/** How long a verified browser may sign without entering a new code. */
export const OTP_SESSION_SEC = 30 * 60;

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Keyed hash: a leaked database row cannot be brute-forced offline without the server secret. */
export function hashOtp(code: string, signerId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${signerId}:${code}`).digest("hex");
}

export function checkOtp(code: string, signerId: string, secret: string, storedHash: string | null): boolean {
  if (!storedHash || !/^\d{6}$/.test(code)) return false;
  return safeEqual(hashOtp(code, signerId, secret), storedHash);
}

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const visible = user.slice(0, Math.min(2, Math.max(1, user.length - 1)));
  return `${visible}${"•".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}
