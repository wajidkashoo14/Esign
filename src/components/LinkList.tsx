"use client";

import { useState } from "react";
import type { IssuedLink } from "@/lib/server/agreements";

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
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** Shown once, straight after sending: the raw token is never stored, so these links cannot be shown again. */
export function LinkList({ links }: { links: IssuedLink[] }) {
  if (!links.length) return null;
  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="text-sm font-medium text-blue-900">Signing links</p>
      <p className="mb-3 text-xs text-blue-800">
        Shown only now (only a hash is stored). Each link is personal to its signer.
      </p>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.signerId}>
            <p className="text-sm text-gray-800">
              {l.name} &lt;{l.email}&gt;{" "}
              <span className={l.emailed ? "text-green-700" : "text-amber-700"}>
                {l.emailed ? "- emailed" : "- not emailed (no email provider configured or sending failed)"}
              </span>
            </p>
            <div className="mt-1 flex gap-2">
              <input readOnly value={l.url} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={l.url} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
