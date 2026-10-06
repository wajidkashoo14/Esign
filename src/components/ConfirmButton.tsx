"use client";

import { useState } from "react";

/**
 * Two-step submit button for irreversible actions: the first click asks for
 * confirmation inline, the second submits the surrounding form.
 */
export function ConfirmButton({
  children,
  confirmText,
  confirmLabel = "Yes, continue",
  pending,
  pendingLabel = "Working...",
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  confirmText: string;
  confirmLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  variant?: "primary" | "danger";
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const solid = variant === "danger" ? "btn-danger-solid" : "btn-primary";

  if (!armed) {
    return (
      <button type="button" className={`btn ${variant === "danger" ? "btn-danger" : "btn-primary"} ${className}`} onClick={() => setArmed(true)}>
        {children}
      </button>
    );
  }
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5" role="alertdialog" aria-live="polite">
      <p className="text-sm text-gray-800">{confirmText}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className={`btn ${solid}`} disabled={pending} autoFocus>
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button type="button" className="btn" disabled={pending} onClick={() => setArmed(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
