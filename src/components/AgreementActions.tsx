"use client";

import { useRouter } from "next/navigation";
import { resendAction, sendAgreementAction, voidAction } from "@/app/actions/agreements";
import { LinkList } from "./LinkList";
import { useServerForm } from "./useServerForm";

export function SendButton({ id }: { id: string }) {
  const { state, pending, onSubmit } = useServerForm(sendAgreementAction);
  const router = useRouter();
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <button
        className="btn btn-primary"
        disabled={pending || state.ok}
        onClick={(e) => {
          if (!confirm("Send this agreement for signature? The text will be locked and cannot be changed afterwards.")) e.preventDefault();
        }}
      >
        {pending ? "Sending..." : "Send for signature"}
      </button>
      {state.error && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && state.links && (
        <>
          <LinkList links={state.links} />
          <button type="button" className="btn mt-3" onClick={() => router.refresh()}>
            Done - show agreement
          </button>
        </>
      )}
    </form>
  );
}

export function ResendButton({ id, signerId, label }: { id: string; signerId: string; label: string }) {
  const { state, pending, onSubmit } = useServerForm(resendAction);
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="signerId" value={signerId} />
      <button className="btn btn-sm" disabled={pending} title="Issues a new link; the previous link stops working">
        {pending ? "..." : label}
      </button>
      {state.error && <p role="alert" className="mt-1 text-xs text-red-700">{state.error}</p>}
      {state.ok && state.links && <LinkList links={state.links} />}
    </form>
  );
}

export function VoidForm({ id }: { id: string }) {
  const { state, pending, onSubmit } = useServerForm(voidAction);
  return (
    <form
      onSubmit={(e) => {
        if (!confirm("Void this agreement? Signing links stop working immediately. This cannot be undone.")) {
          e.preventDefault();
          return;
        }
        onSubmit(e);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <input name="reason" placeholder="Reason (optional)" maxLength={300} className="input max-w-xs" />
      <button className="btn btn-danger" disabled={pending}>{pending ? "Voiding..." : "Void agreement"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
