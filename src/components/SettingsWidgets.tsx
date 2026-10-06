"use client";

import { useState } from "react";
import { checkTotpSetupAction, sendTestEmailAction, startTotpSetupAction } from "@/app/actions/settings";
import { IconMail } from "./Icons";
import { useServerForm } from "./useServerForm";

export function TestEmailButton() {
  const { state, pending, run } = useServerForm(() => sendTestEmailAction());
  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(new FormData())}>
        <IconMail className="h-3.5 w-3.5" /> {pending ? "Sending..." : "Send me a test email"}
      </button>
      {state.ok && <p className="alert-ok">{state.message}</p>}
      {state.error && <p className="alert-error">{state.error}</p>}
    </div>
  );
}

export function TwoStepSetup() {
  const start = useServerForm(() => startTotpSetupAction());
  const check = useServerForm(checkTotpSetupAction);
  const [code, setCode] = useState("");
  const secret = start.state.data?.secret;

  if (!secret) {
    return (
      <button type="button" className="btn btn-primary btn-sm" disabled={start.pending} onClick={() => start.run(new FormData())}>
        {start.pending ? "Preparing..." : "Set up two-step login"}
      </button>
    );
  }
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 p-4">
      <div>
        <p className="font-medium text-gray-900">1. Scan with your authenticator app</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- inline data: QR code */}
        <img src={start.state.data!.qr} alt="QR code for your authenticator app" width={180} height={180} className="mt-2 rounded-lg border border-gray-200 bg-white p-2" />
        <p className="mt-2 text-xs">
          Can’t scan? Enter this key manually: <code className="font-mono text-xs break-all text-gray-900">{secret.match(/.{1,4}/g)?.join(" ")}</code>
        </p>
      </div>
      <form onSubmit={check.onSubmit} className="space-y-2">
        <p className="font-medium text-gray-900">2. Enter the 6-digit code it shows</p>
        <input type="hidden" name="secret" value={secret} />
        <div className="flex gap-2">
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="input max-w-36 text-center font-mono tracking-widest"
            aria-label="Authenticator code"
          />
          <button className="btn" disabled={check.pending || code.length !== 6}>
            Check
          </button>
        </div>
        {check.state.error && <p className="alert-error">{check.state.error}</p>}
      </form>
      {check.state.ok && (
        <div className="alert-ok space-y-2">
          <p className="font-medium">Code accepted. Last step:</p>
          <p>
            Add this environment variable, then redeploy. From then on, signing in will ask for the code.
          </p>
          <code className="block rounded bg-white px-2 py-1.5 font-mono text-xs break-all text-gray-900 ring-1 ring-green-200">OWNER_TOTP_SECRET={secret}</code>
          <p className="text-xs">Keep this key private. Anyone who has it can generate your login codes.</p>
        </div>
      )}
    </div>
  );
}
