"use server";

import { revalidatePath } from "next/cache";
import { UserError, declineToSign, requestSignerOtp, submitSignature, verifySignerOtp } from "@/lib/server/agreements";
import { emailProvider } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { hit } from "@/lib/server/rate-limit";
import { baseUrl, clientInfo, type ClientInfo } from "@/lib/server/request";
import { isSignerVerified, markSignerVerified } from "@/lib/server/signer-session";
import { SignatureError } from "@/lib/signature";
import { sha256Hex } from "@/lib/hash";
import { cleanLine } from "@/lib/sanitize";
import { hashToken } from "@/lib/tokens";
import { flattenErrors, signatureInput } from "@/lib/validation";
import type { ActionState } from "./types";

async function guard(client: ClientInfo, bucket: string, limit: number): Promise<ActionState | null> {
  const res = await hit(`${bucket}:${sha256Hex(client.ip ?? "unknown").slice(0, 32)}`, limit, 10 * 60);
  return res.allowed ? null : { error: "Too many attempts. Please wait a few minutes." };
}

function fail(err: unknown, event: string): ActionState {
  if (err instanceof UserError || err instanceof SignatureError) return { error: err.message };
  log.error(event, err);
  return { error: "Something went wrong. Please try again." };
}

export async function submitSignatureAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const token = String(form.get("token") ?? "");
  const parsed = signatureInput.safeParse({
    consent: form.get("consent") ?? "",
    method: String(form.get("method") ?? ""),
    typedName: String(form.get("typedName") ?? ""),
    image: String(form.get("image") ?? ""),
  });
  if (!parsed.success) return { error: flattenErrors(parsed.error) };

  const client = await clientInfo();
  const limited = await guard(client, "sign", 30);
  if (limited) return limited;

  try {
    const otpVerified = await isSignerVerified(hashToken(token));
    await submitSignature(token, parsed.data, client, await baseUrl(), { otpVerified });
  } catch (err) {
    return fail(err, "signing.failed");
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function requestOtpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const client = await clientInfo();
  const limited = await guard(client, "otp-send", 10);
  if (limited) return limited;
  try {
    const res = await requestSignerOtp(String(form.get("token") ?? ""), client);
    if (!res.delivered && emailProvider() === "none" && process.env.NODE_ENV !== "production") {
      return { ok: true, message: "Email is not configured: in development the code is printed in the server console." };
    }
    if (!res.delivered) {
      return { error: "We couldn't send the email right now. Please try again shortly, or contact the sender." };
    }
    return { ok: true, message: `We sent a 6-digit code to ${res.maskedEmail}.` };
  } catch (err) {
    return fail(err, "signing.otp_send_failed");
  }
}

export async function verifyOtpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const client = await clientInfo();
  const limited = await guard(client, "otp-verify", 20);
  if (limited) return limited;
  try {
    const { tokenHash } = await verifySignerOtp(String(form.get("token") ?? ""), String(form.get("code") ?? ""), client);
    await markSignerVerified(tokenHash);
    return { ok: true };
  } catch (err) {
    return fail(err, "signing.otp_verify_failed");
  }
}

export async function declineAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const client = await clientInfo();
  const limited = await guard(client, "decline", 10);
  if (limited) return limited;
  try {
    await declineToSign(String(form.get("token") ?? ""), cleanLine(String(form.get("reason") ?? ""), 500), client, await baseUrl());
  } catch (err) {
    return fail(err, "signing.decline_failed");
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
