"use client";

import { useState } from "react";
import type { IssuedLink } from "@/lib/server/agreements";
import { IconCheck, IconMail } from "./Icons";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable: the field is selectable */
        }
      }}
    >
      {done ? "Copied" : "Copy link"}
    </button>
  );
}

/** Shown once, straight after sending: the raw token is never stored, so these links cannot be shown again. */
export function LinkList({ links }: { links: IssuedLink[] }) {
  if (!links.length) return null;
  const allEmailed = links.every((l) => l.emailed);
  return (
    <div className={`mt-4 rounded-xl border p-4 ${allEmailed ? "border-green-200 bg-green-50/60" : "border-blue-200 bg-blue-50/60"}`}>
      <p className="text-sm font-medium text-gray-900">{allEmailed ? "Signing links emailed" : "Signing links"}</p>
      <p className="mb-3 text-xs text-gray-600">
        {allEmailed
          ? "Each signer received a personal link. Copies are below if you also want to share them yourself."
          : "Copy each link and send it to its signer. It is shown only now: only a hash is stored."}
      </p>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.signerId} className="rounded-lg bg-white p-3 ring-1 ring-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-gray-900">
                {l.name} <span className="font-normal text-gray-500">{l.email}</span>
              </span>
              {l.emailed ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                  <IconCheck className="h-3.5 w-3.5" /> Emailed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                  <IconMail className="h-3.5 w-3.5" /> {l.error ? `Email failed: ${l.error}` : "Not emailed (email not set up)"}
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input readOnly value={l.url} className="input !py-1.5 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label={`Signing link for ${l.name}`} />
              <CopyButton text={l.url} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
