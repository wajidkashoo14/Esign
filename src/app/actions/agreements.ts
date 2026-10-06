"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/server/auth";
import {
  UserError,
  createDraft,
  deleteDraft,
  resendToSigner,
  sendAgreement,
  updateDraft,
  voidAgreement,
} from "@/lib/server/agreements";
import { log } from "@/lib/server/log";
import { baseUrl, clientInfo } from "@/lib/server/request";
import { cleanLine } from "@/lib/sanitize";
import { agreementInput, flattenErrors } from "@/lib/validation";
import type { ActionState } from "./types";

function fail(err: unknown, event: string): ActionState {
  if (err instanceof UserError) return { error: err.message };
  log.error(event, err);
  return { error: "Something went wrong. Please try again." };
}

function parseAgreementForm(form: FormData) {
  let signers: unknown = [];
  try {
    signers = JSON.parse(String(form.get("signers") ?? "[]"));
  } catch {
    // left empty; validation reports "Add at least one signer"
  }
  const variables: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("var:") && typeof v === "string") variables[k.slice(4)] = v;
  return agreementInput.safeParse({
    title: String(form.get("title") ?? ""),
    body: String(form.get("body") ?? ""),
    signingMode: String(form.get("signingMode") ?? "parallel"),
    expiresAt: String(form.get("expiresAt") ?? "") || undefined,
    signers: Array.isArray(signers) ? signers : [],
    variables,
  });
}

export async function saveAgreementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwner();
  const parsed = parseAgreementForm(form);
  if (!parsed.success) return { error: flattenErrors(parsed.error) };
  const id = String(form.get("id") ?? "");
  let target: string;
  try {
    if (id) {
      await updateDraft(id, parsed.data);
      target = id;
    } else {
      target = await createDraft(parsed.data, await clientInfo());
    }
  } catch (err) {
    return fail(err, "agreement.save_failed");
  }
  revalidatePath("/dashboard");
  redirect(`/agreements/${target}`);
}

export async function sendAgreementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwner();
  const id = String(form.get("id"));
  try {
    const links = await sendAgreement(id, await clientInfo(), await baseUrl());
    // No revalidatePath here: it would re-render the page and unmount the one-time link list.
    // The client calls router.refresh() once the owner has copied the links.
    return { ok: true, links };
  } catch (err) {
    return fail(err, "agreement.send_failed");
  }
}

export async function resendAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwner();
  const id = String(form.get("id"));
  try {
    const links = await resendToSigner(id, String(form.get("signerId")), await clientInfo(), await baseUrl());
    revalidatePath(`/agreements/${id}`);
    return { ok: true, links };
  } catch (err) {
    return fail(err, "agreement.resend_failed");
  }
}

export async function voidAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwner();
  const id = String(form.get("id"));
  try {
    await voidAgreement(id, cleanLine(String(form.get("reason") ?? ""), 300), await clientInfo());
    revalidatePath("/dashboard");
    revalidatePath(`/agreements/${id}`);
    return { ok: true, message: "Agreement voided." };
  } catch (err) {
    return fail(err, "agreement.void_failed");
  }
}

export async function deleteDraftAction(form: FormData): Promise<void> {
  await requireOwner();
  try {
    await deleteDraft(String(form.get("id")));
  } catch (err) {
    if (!(err instanceof UserError)) log.error("agreement.delete_failed", err);
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
