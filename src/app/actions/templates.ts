"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { flattenErrors, templateInput } from "@/lib/validation";
import type { ActionState } from "./types";

export async function createTemplateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwner();
  const parsed = templateInput.safeParse({
    name: String(form.get("name") ?? ""),
    title: String(form.get("title") ?? ""),
    body: String(form.get("body") ?? ""),
  });
  if (!parsed.success) return { error: flattenErrors(parsed.error) };
  await db.template.create({ data: parsed.data });
  revalidatePath("/templates");
  return { ok: true, message: "Template saved." };
}

export async function deleteTemplateAction(form: FormData): Promise<void> {
  await requireOwner();
  await db.template.deleteMany({ where: { id: String(form.get("id")) } });
  revalidatePath("/templates");
}
