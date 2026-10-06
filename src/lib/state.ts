export const AGREEMENT_STATUSES = [
  "draft",
  "sent",
  "partially_signed",
  "completed",
  "voided",
  "expired",
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const STATUS_LABELS: Record<AgreementStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_signed: "Partially signed",
  completed: "Completed",
  voided: "Voided",
  expired: "Expired",
};

const TRANSITIONS: Record<AgreementStatus, readonly AgreementStatus[]> = {
  draft: ["sent"],
  sent: ["partially_signed", "completed", "voided", "expired"],
  partially_signed: ["completed", "voided", "expired"],
  completed: [],
  voided: [],
  expired: [],
};

export function isStatus(v: string): v is AgreementStatus {
  return (AGREEMENT_STATUSES as readonly string[]).includes(v);
}

export function canTransition(from: AgreementStatus, to: AgreementStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AgreementStatus, to: AgreementStatus): void {
  if (!canTransition(from, to)) throw new Error(`Illegal status transition: ${from} -> ${to}`);
}

export const isOpen = (s: AgreementStatus) => s === "sent" || s === "partially_signed";
export const isTerminal = (s: AgreementStatus) => TRANSITIONS[s].length === 0;
/** The body, signers and settings can only change while in draft. */
export const canEdit = (s: AgreementStatus) => s === "draft";
export const canSend = (s: AgreementStatus) => s === "draft";
export const canVoid = (s: AgreementStatus) => isOpen(s);
export const canResend = (s: AgreementStatus) => isOpen(s);

/** Status after applying the expiry date; expiry only affects open agreements. */
export function effectiveStatus(
  status: AgreementStatus,
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): AgreementStatus {
  if (isOpen(status) && expiresAt && expiresAt.getTime() <= now.getTime()) return "expired";
  return status;
}

/** Status after a signer has signed. */
export function statusAfterSignature(signedCount: number, totalSigners: number): AgreementStatus {
  if (totalSigners > 0 && signedCount >= totalSigners) return "completed";
  return signedCount > 0 ? "partially_signed" : "sent";
}

export type SigningMode = "parallel" | "sequential";

export interface SignerState {
  id: string;
  order: number;
  signed: boolean;
}

/** Whether `signerId` may sign now, given the signing mode and the other signers. */
export function canSignerSign(mode: SigningMode, signerId: string, signers: SignerState[]): boolean {
  const me = signers.find((s) => s.id === signerId);
  if (!me || me.signed) return false;
  if (mode === "parallel") return true;
  return signers.every((s) => s.id === signerId || s.order >= me.order || s.signed);
}

/** Signers who should be notified next in sequential mode (lowest unsigned order). */
export function nextSequentialSigners(signers: SignerState[]): SignerState[] {
  const pending = signers.filter((s) => !s.signed);
  if (!pending.length) return [];
  const min = Math.min(...pending.map((s) => s.order));
  return pending.filter((s) => s.order === min);
}
