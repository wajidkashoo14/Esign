"use server";

import QRCode from "qrcode";
import { requireOwner } from "@/lib/server/auth";
import { sendMail } from "@/lib/server/email";
import { emailProvider, env } from "@/lib/server/env";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import type { ActionState } from "./types";

export async function sendTestEmailAction(): Promise<ActionState> {
  await requireOwner();
  if (emailProvider() === "none") return { error: "No email provider is configured yet (set RESEND_API_KEY or SMTP_HOST)." };
  const res = await sendMail({
    ref: "owner",
    to: env().OWNER_EMAIL,
    subject: "E-Sign test email",
    heading: "Email delivery works",
    text: "This is a test message from your E-Sign app. Signers will receive their links and codes from this address.",
  });
  return res.delivered
    ? { ok: true, message: `Sent to ${env().OWNER_EMAIL}. Check your inbox (and spam folder).` }
    : { error: `Sending failed: ${res.error ?? "unknown error"}` };
}

export async function startTotpSetupAction(): Promise<ActionState> {
  await requireOwner();
  const secret = generateTotpSecret();
  const uri = otpauthUri(secret, env().OWNER_EMAIL, "E-Sign");
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 220, errorCorrectionLevel: "M" });
  return { ok: true, data: { secret, qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` } };
}

export async function checkTotpSetupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwner();
  const secret = String(form.get("secret") ?? "");
  const code = String(form.get("code") ?? "").replace(/\s+/g, "");
  if (verifyTotp(secret, code) === null) return { error: "That code doesn't match. Check the time on your phone and try the newest code." };
  return { ok: true, message: "Code accepted." };
}
