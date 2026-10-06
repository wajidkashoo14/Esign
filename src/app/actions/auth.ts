"use server";

import { redirect } from "next/navigation";
import { checkCredentials, checkTotp, endSession, startSession } from "@/lib/server/auth";
import { totpEnabled } from "@/lib/server/env";
import { clear, hit } from "@/lib/server/rate-limit";
import { clientInfo } from "@/lib/server/request";
import { log } from "@/lib/server/log";
import { sha256Hex } from "@/lib/hash";
import type { ActionState } from "./types";

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").slice(0, 254);
  const password = String(form.get("password") ?? "");
  const { ip } = await clientInfo();

  // Per-IP window, plus a global window so a botnet can't brute-force the single owner account.
  const ipKey = `login:ip:${sha256Hex(ip ?? "unknown").slice(0, 32)}`;
  const [perIp, global] = await Promise.all([hit(ipKey, 8, 15 * 60), hit("login:global", 60, 60 * 60)]);
  if (!perIp.allowed || !global.allowed) {
    log.warn("auth.rate_limited");
    const mins = Math.ceil(Math.max(perIp.retryAfterSec, global.retryAfterSec) / 60);
    return { error: `Too many attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  const twoStep = totpEnabled();
  const credentialsOk = await checkCredentials(email, password);
  // Check the code only after the password, and give one generic error either way.
  const codeOk = credentialsOk && (await checkTotp(String(form.get("code") ?? "")));
  if (!credentialsOk || !codeOk) {
    log.warn("auth.login_failed");
    return { error: twoStep ? "Invalid email, password or authenticator code." : "Invalid email or password." };
  }
  await clear(ipKey);
  await startSession();
  log.info("auth.login_ok");
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
