import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDraftForm, ResendButton, SendButton, VoidForm } from "@/components/AgreementActions";
import { AgreementBody } from "@/components/AgreementBody";
import { IconBan, IconCheck, IconClock, IconDownload, IconEye, IconMail, IconPen, IconSend, IconShield, IconX } from "@/components/Icons";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDateTime } from "@/lib/format";
import { expireOverdue, finalizeAgreement } from "@/lib/server/agreements";
import { db } from "@/lib/server/db";
import { canResend, canSignerSign, canVoid, isStatus, type SigningMode } from "@/lib/state";
import { renderTemplate } from "@/lib/template";

export const metadata = { title: "Agreement" };

const EVENTS: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  created: { label: "Draft created", icon: <IconPen className="h-3.5 w-3.5" />, tone: "bg-gray-100 text-gray-600" },
  sent: { label: "Link sent", icon: <IconSend className="h-3.5 w-3.5" />, tone: "bg-blue-100 text-blue-700" },
  resent: { label: "New link issued", icon: <IconSend className="h-3.5 w-3.5" />, tone: "bg-blue-100 text-blue-700" },
  viewed: { label: "Opened the document", icon: <IconEye className="h-3.5 w-3.5" />, tone: "bg-gray-100 text-gray-600" },
  otp_sent: { label: "Email code sent", icon: <IconMail className="h-3.5 w-3.5" />, tone: "bg-gray-100 text-gray-600" },
  otp_verified: { label: "Email verified with code", icon: <IconShield className="h-3.5 w-3.5" />, tone: "bg-indigo-100 text-indigo-700" },
  signed: { label: "Signed", icon: <IconCheck className="h-3.5 w-3.5" />, tone: "bg-green-100 text-green-700" },
  declined: { label: "Declined to sign", icon: <IconX className="h-3.5 w-3.5" />, tone: "bg-rose-100 text-rose-700" },
  completed: { label: "All parties signed", icon: <IconCheck className="h-3.5 w-3.5" />, tone: "bg-green-600 text-white" },
  voided: { label: "Voided", icon: <IconBan className="h-3.5 w-3.5" />, tone: "bg-gray-200 text-gray-700" },
  expired: { label: "Expired", icon: <IconClock className="h-3.5 w-3.5" />, tone: "bg-orange-100 text-orange-700" },
};

export default async function AgreementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await expireOverdue(id);
  let a = await db.agreement.findUnique({
    where: { id },
    include: { signers: { orderBy: { order: "asc" } }, events: { orderBy: { createdAt: "desc" }, include: { signer: true } } },
  });
  if (!a) notFound();
  const status = isStatus(a.status) ? a.status : "draft";
  if (status === "completed" && !a.finalPdf) {
    await finalizeAgreement(id);
    a = (await db.agreement.findUnique({
      where: { id },
      include: { signers: { orderBy: { order: "asc" } }, events: { orderBy: { createdAt: "desc" }, include: { signer: true } } },
    }))!;
  }
  const states = a.signers.map((s) => ({ id: s.id, order: s.order, signed: !!s.signedAt }));
  const mode = a.signingMode as SigningMode;
  const signed = a.signers.filter((s) => s.signedAt).length;
  const vars = JSON.parse(a.variables) as Record<string, string>;
  const bodyText = a.renderedBody ?? renderTemplate(a.body, Object.fromEntries(Object.entries(vars).filter(([, v]) => v.trim())));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← All agreements</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{a.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              <StatusBadge status={status} />
              <span>{mode === "sequential" ? "Signed in order" : "Signed in parallel"}</span>
              <span>
                {signed} of {a.signers.length} signed
              </span>
              {a.expiresAt && <span>Expires {fmtDateTime(a.expiresAt)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "completed" && (
              <a href={`/api/agreements/${a.id}/pdf`} className="btn btn-primary">
                <IconDownload /> Download signed PDF
              </a>
            )}
            {status === "draft" && (
              <Link href={`/agreements/${a.id}/edit`} className="btn">
                <IconPen /> Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      {status === "voided" && (
        <p className="alert-warn">
          Voided {fmtDateTime(a.voidedAt)}
          {a.voidReason ? `: ${a.voidReason}` : ""}
        </p>
      )}
      {status === "declined" &&
        a.signers
          .filter((s) => s.declinedAt)
          .map((s) => (
            <p key={s.id} className="alert-error">
              <strong>{s.name}</strong> declined to sign on {fmtDateTime(s.declinedAt)}
              {s.declineReason ? `: "${s.declineReason}"` : "."} The agreement is closed. To try again, create a corrected agreement and send it.
            </p>
          ))}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {status === "draft" && (
            <section className="card">
              <h2 className="card-title">Ready to send?</h2>
              <p className="mt-1 mb-4 text-sm text-gray-500">
                Check the document below. Once sent, each signer gets a personal link and the text can no longer be edited.
              </p>
              <SendButton id={a.id} signerCount={a.signers.length} />
            </section>
          )}

          <section className="card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="card-title">Document</h2>
              {status !== "draft" && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <IconShield className="h-3.5 w-3.5" /> Locked since {fmtDateTime(a.sentAt)}
                </span>
              )}
            </div>
            <div className="max-h-[640px] overflow-auto rounded-xl border border-gray-100 bg-gray-50/50 px-5 py-4">
              <AgreementBody text={bodyText} />
            </div>
          </section>

          {(a.docHash || a.finalPdfHash) && (
            <section className="card space-y-3 text-sm">
              <h2 className="card-title">Integrity</h2>
              {a.docHash && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Document SHA-256 (recorded when sent)</p>
                  <code className="block font-mono text-xs break-all text-gray-800">{a.docHash}</code>
                </div>
              )}
              {a.finalPdfHash && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Signed PDF SHA-256</p>
                  <code className="block font-mono text-xs break-all text-gray-800">{a.finalPdfHash}</code>
                </div>
              )}
              {status === "completed" && (
                <p className={a.finalPdfSealed ? "alert-ok" : "alert-info"}>
                  {a.finalPdfSealed
                    ? "The signed PDF is digitally sealed: PDF readers will flag any change made to it."
                    : "The signed PDF is not digitally sealed. Set up a seal certificate in Settings to seal future PDFs."}
                </p>
              )}
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="card">
            <h2 className="card-title mb-3">Signers</h2>
            <ul className="space-y-3">
              {a.signers.map((s) => {
                const open = canResend(status) && !s.signedAt;
                const myTurn = canSignerSign(mode, s.id, states);
                const [label, tone] = s.signedAt
                  ? [`Signed ${fmtDateTime(s.signedAt)}`, "text-green-700"]
                  : s.declinedAt
                    ? ["Declined", "text-rose-700"]
                    : status === "draft"
                      ? ["Not sent yet", "text-gray-500"]
                      : status === "voided" || status === "expired" || status === "declined"
                        ? [status === "expired" ? "Expired" : "Cancelled", "text-gray-500"]
                        : !myTurn
                          ? ["Waiting for earlier signers", "text-gray-500"]
                          : s.viewedAt
                            ? [`Opened ${fmtDateTime(s.viewedAt)}`, "text-blue-700"]
                            : ["Waiting to open", "text-gray-600"];
                return (
                  <li key={s.id} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid h-8 w-8 flex-none place-items-center rounded-full text-xs font-semibold ${
                          s.signedAt ? "bg-green-100 text-green-700" : s.declinedAt ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {s.signedAt ? <IconCheck /> : s.declinedAt ? <IconX /> : s.order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="truncate text-sm text-gray-500">{s.email}</p>
                        <p className={`mt-1 text-xs ${tone}`}>{label}</p>
                        {s.otpVerifiedAt && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-700">
                            <IconShield className="h-3 w-3" /> Email verified
                          </p>
                        )}
                      </div>
                    </div>
                    {open && myTurn && (
                      <div className="mt-2">
                        <ResendButton id={a.id} signerId={s.id} label={s.tokenHash ? "Resend link" : "Send link"} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <h2 className="card-title mb-4">Activity</h2>
            <ol className="space-y-4">
              {a.events.map((e) => {
                const ev = EVENTS[e.type] ?? { label: e.type, icon: <IconClock className="h-3.5 w-3.5" />, tone: "bg-gray-100 text-gray-600" };
                const meta = e.meta ? (JSON.parse(e.meta) as Record<string, unknown>) : {};
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full ${ev.tone}`}>{ev.icon}</span>
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-gray-900">
                        {ev.label}
                        {e.signer && <span className="font-normal text-gray-500"> · {e.signer.name}</span>}
                      </p>
                      {(e.type === "declined" || e.type === "voided") && typeof meta.reason === "string" && <p className="text-xs text-gray-600">&ldquo;{meta.reason}&rdquo;</p>}
                      <p className="text-xs text-gray-500">
                        {fmtDateTime(e.createdAt)}
                        {e.ip ? ` · ${e.ip}` : ""}
                      </p>
                      {e.userAgent && <p className="truncate text-[11px] text-gray-400" title={e.userAgent}>{e.userAgent}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {canVoid(status) && (
            <section className="card">
              <h2 className="card-title mb-3">Cancel this request</h2>
              <VoidForm id={a.id} />
            </section>
          )}
          {status === "draft" && (
            <section className="card">
              <h2 className="card-title mb-3">Delete</h2>
              <DeleteDraftForm id={a.id} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
