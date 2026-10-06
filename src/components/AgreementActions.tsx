"use client";

import { useRouter } from "next/navigation";
import { deleteDraftAction, resendAction, sendAgreementAction, voidAction } from "@/app/actions/agreements";
import { ConfirmButton } from "./ConfirmButton";
import { IconRefresh, IconSend } from "./Icons";
import { LinkList } from "./LinkList";
import { useServerForm } from "./useServerForm";

export function SendButton({ id, signerCount }: { id: string; signerCount: number }) {
  const { state, pending, onSubmit } = useServerForm(sendAgreementAction);
  const router = useRouter();
  if (state.ok && state.links) {
    return (
      <div>
        <LinkList links={state.links} />
        <button type="button" className="btn btn-primary mt-4" onClick={() => router.refresh()}>
          Done
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmButton
        confirmText={`Send to ${signerCount} signer${signerCount === 1 ? "" : "s"}? The text will be locked and can't be changed afterwards.`}
        confirmLabel="Yes, send now"
        pending={pending}
        pendingLabel="Sending..."
      >
        <IconSend /> Send for signature
      </ConfirmButton>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
    </form>
  );
}

export function ResendButton({ id, signerId, label }: { id: string; signerId: string; label: string }) {
  const { state, pending, onSubmit } = useServerForm(resendAction);
  return (
    <form onSubmit={onSubmit} className="w-full">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="signerId" value={signerId} />
      <div className="flex justify-end">
        <button className="btn btn-sm" disabled={pending} title="Issues a new link; the previous link stops working">
          <IconRefresh className="h-3.5 w-3.5" /> {pending ? "Sending..." : label}
        </button>
      </div>
      {state.error && <p role="alert" className="mt-2 text-xs text-red-700">{state.error}</p>}
      {state.ok && state.links && <LinkList links={state.links} />}
    </form>
  );
}

export function VoidForm({ id }: { id: string }) {
  const { state, pending, onSubmit } = useServerForm(voidAction);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label" htmlFor="void-reason">Reason (optional, shared with signers)</label>
        <input id="void-reason" name="reason" maxLength={300} className="input" placeholder="e.g. Terms changed, a new version will follow" />
      </div>
      <ConfirmButton
        variant="danger"
        confirmText="Void this agreement? All signing links stop working immediately and signers who haven't signed are told. This can't be undone."
        confirmLabel="Yes, void it"
        pending={pending}
        pendingLabel="Voiding..."
      >
        Void agreement
      </ConfirmButton>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
    </form>
  );
}

export function DeleteDraftForm({ id }: { id: string }) {
  return (
    <form action={deleteDraftAction}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton variant="danger" confirmText="Delete this draft permanently?" confirmLabel="Yes, delete">
        Delete draft
      </ConfirmButton>
    </form>
  );
}
