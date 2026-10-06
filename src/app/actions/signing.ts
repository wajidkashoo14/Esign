"use server";

import { revalidatePath } from "next/cache";
import { UserError, submitSignature } from "@/lib/server/agreements";
import { log } from "@/lib/server/log";
import { hit } from "@/lib/server/rate-limit";
import { baseUrl, clientInfo } from "@/lib/server/request";
import { SignatureError } from "@/lib/signature";
import { sha256Hex } from "@/lib/hash";
import { flattenErrors, signatureInput } from "@/lib/validation";
import type { ActionState } from "./types";

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
  const limit = await hit(`sign:${sha256Hex(client.ip ?? "unknown").slice(0, 32)}`, 30, 10 * 60);
  if (!limit.allowed) return { error: "Too many attempts. Please wait a few minutes." };

  try {
    await submitSignature(token, parsed.data, client, await baseUrl());
  } catch (err) {
    if (err instanceof UserError || err instanceof SignatureError) return { error: err.message };
    log.error("signing.failed", err);
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
