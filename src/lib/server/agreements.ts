import "server-only";
import type { Prisma } from "@prisma/client";
import { documentHash, sha256Hex } from "../hash";
import { parseSignatureDataUrl } from "../signature";
import {
  canResend,
  canVoid,
  canSignerSign,
  effectiveStatus,
  isOpen,
  isStatus,
  nextSequentialSigners,
  statusAfterSignature,
  type AgreementStatus,
  type SigningMode,
} from "../state";
import { missingVariables, renderTemplate } from "../template";
import type { AgreementInput } from "../validation";
import { db } from "./db";
import { sendMail } from "./email";
import { env } from "./env";
import { log } from "./log";
import { buildFinalPdf } from "./pdf";
import { generateToken, hashToken, isWellFormedToken, verifyToken } from "../tokens";
import type { ClientInfo } from "./request";

export class UserError extends Error {}

export const CONSENT_TEXT_VERSION = "2026-01";

const OPEN: AgreementStatus[] = ["sent", "partially_signed"];

type Tx = Prisma.TransactionClient;

export interface IssuedLink {
  signerId: string;
  name: string;
  email: string;
  url: string;
  emailed: boolean;
}

const statusOf = (s: string): AgreementStatus => (isStatus(s) ? s : "draft");

async function addEvent(
  tx: Tx | typeof db,
  e: { agreementId: string; signerId?: string | null; type: string; client: ClientInfo | null; meta?: Record<string, unknown> },
) {
  await tx.auditEvent.create({
    data: {
      agreementId: e.agreementId,
      signerId: e.signerId ?? null,
      type: e.type,
      ip: e.client?.ip ?? null,
      userAgent: e.client?.userAgent ?? null,
      meta: e.meta ? JSON.stringify(e.meta) : null,
    },
  });
}

// ---------------------------------------------------------------- drafts

export async function createDraft(input: AgreementInput, client: ClientInfo): Promise<string> {
  const a = await db.agreement.create({
    data: {
      title: input.title,
      body: input.body,
      variables: JSON.stringify(input.variables),
      signingMode: input.signingMode,
      expiresAt: input.expiresAt,
      signers: { create: input.signers.map((s, i) => ({ name: s.name, email: s.email, order: i + 1 })) },
    },
  });
  await addEvent(db, { agreementId: a.id, type: "created", client });
  return a.id;
}

export async function updateDraft(id: string, input: AgreementInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const res = await tx.agreement.updateMany({
      where: { id, status: "draft" },
      data: {
        title: input.title,
        body: input.body,
        variables: JSON.stringify(input.variables),
        signingMode: input.signingMode,
        expiresAt: input.expiresAt,
      },
    });
    if (res.count !== 1) throw new UserError("Only drafts can be edited. The document is locked once sent.");
    await tx.signer.deleteMany({ where: { agreementId: id } });
    await tx.signer.createMany({ data: input.signers.map((s, i) => ({ agreementId: id, name: s.name, email: s.email, order: i + 1 })) });
  });
}

export async function deleteDraft(id: string): Promise<void> {
  const res = await db.agreement.deleteMany({ where: { id, status: "draft" } });
  if (res.count !== 1) throw new UserError("Only drafts can be deleted. Void the agreement instead.");
}

// ---------------------------------------------------------------- expiry

/** Mark any open agreement past its expiry date as expired (and audit it). */
export async function expireOverdue(agreementId?: string): Promise<void> {
  const now = new Date();
  const due = await db.agreement.findMany({
    where: { status: { in: OPEN }, expiresAt: { lte: now }, ...(agreementId ? { id: agreementId } : {}) },
    select: { id: true },
  });
  for (const { id } of due) {
    const res = await db.agreement.updateMany({ where: { id, status: { in: OPEN } }, data: { status: "expired" } });
    if (res.count === 1) await addEvent(db, { agreementId: id, type: "expired", client: null });
  }
}

// ---------------------------------------------------------------- sending

async function issueToken(tx: Tx | typeof db, signerId: string): Promise<string> {
  const token = generateToken();
  await tx.signer.update({ where: { id: signerId }, data: { tokenHash: hashToken(token), tokenIssuedAt: new Date() } });
  return token;
}

async function deliverLinks(
  agreement: { title: string },
  issued: { signerId: string; name: string; email: string; token: string }[],
  base: string,
  kind: "request" | "reminder",
): Promise<IssuedLink[]> {
  const out: IssuedLink[] = [];
  for (const i of issued) {
    const url = `${base}/sign/${i.token}`;
    const res = await sendMail({
      ref: i.signerId,
      to: i.email,
      subject: `${kind === "reminder" ? "Reminder: " : ""}Please sign: ${agreement.title}`,
      text: `Hello ${i.name},\n\nYou have been asked to review and electronically sign "${agreement.title}".\n\nThe link below is personal to you. Please do not forward it.`,
      action: { label: "Review and sign", url },
    });
    out.push({ signerId: i.signerId, name: i.name, email: i.email, url, emailed: res.delivered });
  }
  return out;
}

export async function sendAgreement(id: string, client: ClientInfo, base: string): Promise<IssuedLink[]> {
  const a = await db.agreement.findUnique({ where: { id }, include: { signers: { orderBy: { order: "asc" } } } });
  if (!a) throw new UserError("Agreement not found.");
  if (a.status !== "draft") throw new UserError("This agreement has already been sent.");
  if (!a.signers.length) throw new UserError("Add at least one signer before sending.");
  if (a.expiresAt && a.expiresAt.getTime() <= Date.now()) throw new UserError("The expiry date is in the past.");

  const vars = JSON.parse(a.variables) as Record<string, string>;
  const missing = missingVariables(`${a.title}\n${a.body}`, vars);
  if (missing.length) throw new UserError(`Fill in a value for: ${missing.map((m) => `{{${m}}}`).join(", ")}`);

  const title = renderTemplate(a.title, vars);
  const renderedBody = renderTemplate(a.body, vars);
  const docHash = documentHash(title, renderedBody);
  const mode = a.signingMode as SigningMode;
  const states = a.signers.map((s) => ({ id: s.id, order: s.order, signed: false }));
  const firstIds = new Set((mode === "sequential" ? nextSequentialSigners(states) : states).map((s) => s.id));

  const tokens = new Map<string, string>();
  await db.$transaction(async (tx) => {
    const res = await tx.agreement.updateMany({
      where: { id, status: "draft" },
      data: { status: "sent", title, renderedBody, docHash, sentAt: new Date() },
    });
    if (res.count !== 1) throw new UserError("This agreement has already been sent.");
    for (const s of a.signers) {
      if (!firstIds.has(s.id)) continue;
      tokens.set(s.id, await issueToken(tx, s.id));
      await addEvent(tx, { agreementId: id, signerId: s.id, type: "sent", client, meta: { docHash, mode } });
    }
  });

  const issued = a.signers.filter((s) => tokens.has(s.id)).map((s) => ({ signerId: s.id, name: s.name, email: s.email, token: tokens.get(s.id)! }));
  log.info("agreement.sent", { agreementId: id, recipients: issued.length });
  return deliverLinks({ title }, issued, base, "request");
}

/** Issue a fresh link for one signer (invalidates their previous link). */
export async function resendToSigner(agreementId: string, signerId: string, client: ClientInfo, base: string): Promise<IssuedLink[]> {
  await expireOverdue(agreementId);
  const a = await db.agreement.findUnique({ where: { id: agreementId }, include: { signers: true } });
  if (!a) throw new UserError("Agreement not found.");
  if (!canResend(statusOf(a.status))) throw new UserError("This agreement is no longer open for signing.");
  const signer = a.signers.find((s) => s.id === signerId);
  if (!signer) throw new UserError("Signer not found.");
  if (signer.signedAt) throw new UserError("This signer has already signed.");
  const states = a.signers.map((s) => ({ id: s.id, order: s.order, signed: !!s.signedAt }));
  if (!canSignerSign(a.signingMode as SigningMode, signerId, states)) {
    throw new UserError("It is not this signer's turn yet (sequential signing).");
  }
  const token = await db.$transaction(async (tx) => {
    const t = await issueToken(tx, signerId);
    await addEvent(tx, { agreementId, signerId, type: "resent", client });
    return t;
  });
  return deliverLinks(a, [{ signerId, name: signer.name, email: signer.email, token }], base, "reminder");
}

// ---------------------------------------------------------------- void

export async function voidAgreement(id: string, reason: string, client: ClientInfo): Promise<void> {
  await expireOverdue(id);
  const a = await db.agreement.findUnique({ where: { id }, include: { signers: true } });
  if (!a) throw new UserError("Agreement not found.");
  if (!canVoid(statusOf(a.status))) throw new UserError("Only agreements that are out for signature can be voided.");
  const res = await db.agreement.updateMany({
    where: { id, status: { in: OPEN } },
    data: { status: "voided", voidedAt: new Date(), voidReason: reason || null },
  });
  if (res.count !== 1) throw new UserError("The agreement changed while voiding. Reload and try again.");
  await db.signer.updateMany({ where: { agreementId: id }, data: { tokenHash: null } });
  await addEvent(db, { agreementId: id, type: "voided", client, meta: reason ? { reason } : undefined });
  for (const s of a.signers.filter((s) => !s.signedAt && s.tokenIssuedAt)) {
    await sendMail({
      ref: s.id,
      to: s.email,
      subject: `Cancelled: ${a.title}`,
      text: `Hello ${s.name},\n\nThe request to sign "${a.title}" has been cancelled by the sender. The signing link no longer works.${reason ? `\n\nReason given: ${reason}` : ""}`,
    });
  }
}

// ---------------------------------------------------------------- signing

export type SigningView =
  | { kind: "invalid" }
  | {
      kind: "ok";
      agreementId: string;
      signerId: string;
      signerName: string;
      title: string;
      body: string;
      docHash: string;
      status: AgreementStatus;
      expiresAt: Date | null;
      signedAt: Date | null;
      canSign: boolean;
      waitingForOthers: boolean;
      voidReason: string | null;
    };

async function findSignerByToken(token: string) {
  if (!isWellFormedToken(token)) return null;
  const hash = hashToken(token);
  const signer = await db.signer.findUnique({ where: { tokenHash: hash }, include: { agreement: { include: { signers: true } } } });
  if (!signer || !verifyToken(token, signer.tokenHash)) return null;
  return signer;
}

export async function loadSigningView(token: string, client: ClientInfo): Promise<SigningView> {
  const found = await findSignerByToken(token);
  if (!found) return { kind: "invalid" };
  await expireOverdue(found.agreementId);
  const signer = (await findSignerByToken(token))!;
  const a = signer.agreement;
  const status = effectiveStatus(statusOf(a.status), a.expiresAt);
  if (status === "draft" || !a.renderedBody || !a.docHash) return { kind: "invalid" };

  // Record a view for open agreements (at most one every 10 minutes per signer).
  if (isOpen(status) && !signer.signedAt && (!signer.viewedAt || Date.now() - signer.viewedAt.getTime() > 10 * 60_000)) {
    await db.signer.update({ where: { id: signer.id }, data: { viewedAt: new Date() } });
    await addEvent(db, { agreementId: a.id, signerId: signer.id, type: "viewed", client });
  }

  const states = a.signers.map((s) => ({ id: s.id, order: s.order, signed: !!s.signedAt }));
  const turn = canSignerSign(a.signingMode as SigningMode, signer.id, states);
  return {
    kind: "ok",
    agreementId: a.id,
    signerId: signer.id,
    signerName: signer.name,
    title: a.title,
    body: a.renderedBody,
    docHash: a.docHash,
    status,
    expiresAt: a.expiresAt,
    signedAt: signer.signedAt,
    canSign: isOpen(status) && turn,
    waitingForOthers: isOpen(status) && !signer.signedAt && !turn,
    voidReason: a.voidReason,
  };
}

export interface SignatureSubmission {
  method: "typed" | "drawn";
  typedName: string;
  image: string;
}

export async function submitSignature(token: string, sig: SignatureSubmission, client: ClientInfo, base: string): Promise<void> {
  const found = await findSignerByToken(token);
  if (!found) throw new UserError("This signing link is not valid.");
  await expireOverdue(found.agreementId);
  const png = parseSignatureDataUrl(sig.image);

  const result = await db.$transaction(async (tx) => {
    const signer = await tx.signer.findUnique({ where: { id: found.id }, include: { agreement: { include: { signers: true } } } });
    if (!signer || !verifyToken(token, signer.tokenHash)) throw new UserError("This signing link is not valid.");
    const a = signer.agreement;
    const status = statusOf(a.status);
    if (status === "voided") throw new UserError("This agreement was cancelled by the sender.");
    if (status === "expired") throw new UserError("This agreement has expired.");
    if (!isOpen(status)) throw new UserError("This agreement is not open for signing.");
    if (signer.signedAt) throw new UserError("You have already signed this agreement.");
    const states = a.signers.map((s) => ({ id: s.id, order: s.order, signed: !!s.signedAt }));
    if (!canSignerSign(a.signingMode as SigningMode, signer.id, states)) throw new UserError("It is not your turn to sign yet.");

    const now = new Date();
    const mark = await tx.signer.updateMany({
      where: { id: signer.id, signedAt: null },
      data: {
        signedAt: now,
        consentAt: now,
        signatureType: sig.method,
        signatureName: sig.method === "typed" ? sig.typedName : null,
        signatureImg: Buffer.from(png),
      },
    });
    if (mark.count !== 1) throw new UserError("You have already signed this agreement.");

    const signedCount = await tx.signer.count({ where: { agreementId: a.id, signedAt: { not: null } } });
    const next = statusAfterSignature(signedCount, a.signers.length);
    const upd = await tx.agreement.updateMany({
      where: { id: a.id, status: { in: OPEN } },
      data: { status: next, ...(next === "completed" ? { completedAt: now } : {}) },
    });
    if (upd.count !== 1) throw new UserError("The agreement changed while signing. Please reload.");

    await addEvent(tx, {
      agreementId: a.id,
      signerId: signer.id,
      type: "signed",
      client,
      meta: { method: sig.method, consent: true, consentTextVersion: CONSENT_TEXT_VERSION, docHash: a.docHash },
    });
    if (next === "completed") await addEvent(tx, { agreementId: a.id, type: "completed", client: null, meta: { docHash: a.docHash } });
    return { agreementId: a.id, completed: next === "completed", mode: a.signingMode as SigningMode, title: a.title };
  });

  if (result.completed) {
    await finalizeAgreement(result.agreementId);
    return;
  }
  if (result.mode === "sequential") await activateNextSigners(result.agreementId, base);
}

/** Sequential mode: after a signature, notify whoever is up next. */
async function activateNextSigners(agreementId: string, base: string): Promise<void> {
  const a = await db.agreement.findUnique({ where: { id: agreementId }, include: { signers: true } });
  if (!a || !isOpen(statusOf(a.status))) return;
  const next = nextSequentialSigners(a.signers.map((s) => ({ id: s.id, order: s.order, signed: !!s.signedAt })));
  const issued: { signerId: string; name: string; email: string; token: string }[] = [];
  for (const n of next) {
    const s = a.signers.find((x) => x.id === n.id)!;
    if (s.tokenHash) continue; // already has a link
    const token = await db.$transaction(async (tx) => {
      const t = await issueToken(tx, s.id);
      await addEvent(tx, { agreementId, signerId: s.id, type: "sent", client: null, meta: { reason: "previous signer completed" } });
      return t;
    });
    issued.push({ signerId: s.id, name: s.name, email: s.email, token });
  }
  await deliverLinks(a, issued, base, "request");
}

// ---------------------------------------------------------------- completion

/** Idempotent: builds the final PDF for a completed agreement, stores its hash, emails all parties once. */
export async function finalizeAgreement(agreementId: string): Promise<Uint8Array | null> {
  const a = await db.agreement.findUnique({
    where: { id: agreementId },
    include: { signers: true, events: { orderBy: { createdAt: "asc" }, include: { signer: true } } },
  });
  if (!a || a.status !== "completed" || !a.docHash || !a.renderedBody) return null;
  if (a.finalPdf) return a.finalPdf;

  const pdf = await buildFinalPdf({
    agreementId: a.id,
    title: a.title,
    body: a.renderedBody,
    docHash: a.docHash,
    sentAt: a.sentAt,
    completedAt: a.completedAt,
    signers: a.signers.map((s) => ({
      name: s.name,
      email: s.email,
      order: s.order,
      signedAt: s.signedAt,
      signatureType: s.signatureType,
      signatureName: s.signatureName,
      signatureImg: s.signatureImg,
    })),
    events: a.events.map((e) => ({
      at: e.createdAt,
      type: e.type,
      actor: !e.signer
        ? "Owner / system"
        : e.type === "sent" || e.type === "resent"
          ? `Owner (link for ${e.signer.name} <${e.signer.email}>)`
          : `${e.signer.name} <${e.signer.email}>`,
      ip: e.ip,
      userAgent: e.userAgent,
    })),
  });
  const hash = sha256Hex(pdf);
  const claim = await db.agreement.updateMany({
    where: { id: a.id, finalPdf: null },
    data: { finalPdf: Buffer.from(pdf), finalPdfHash: hash },
  });
  if (claim.count !== 1) return (await db.agreement.findUnique({ where: { id: a.id } }))?.finalPdf ?? null;

  log.info("agreement.completed", { agreementId: a.id });
  const recipients = [...a.signers.map((s) => ({ ref: s.id, name: s.name, email: s.email })), { ref: "owner", name: "Owner", email: env().OWNER_EMAIL }];
  for (const r of recipients) {
    await sendMail({
      ref: r.ref,
      to: r.email,
      subject: `Completed: ${a.title}`,
      text: `Hello ${r.name},\n\nAll parties have signed "${a.title}". The signed document, with its Certificate of Completion, is attached.\n\nPDF SHA-256: ${hash}`,
      attachments: [{ filename: `${safeFilename(a.title)}-signed.pdf`, content: pdf, contentType: "application/pdf" }],
    });
  }
  return pdf;
}

export function safeFilename(title: string): string {
  return title.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "agreement";
}
