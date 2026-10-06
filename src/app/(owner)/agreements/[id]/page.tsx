import Link from "next/link";
import { notFound } from "next/navigation";
import { ResendButton, SendButton, VoidForm } from "@/components/AgreementActions";
import { StatusBadge } from "@/components/StatusBadge";
import { deleteDraftAction } from "@/app/actions/agreements";
import { fmtDateTime } from "@/lib/format";
import { db } from "@/lib/server/db";
import { expireOverdue, finalizeAgreement } from "@/lib/server/agreements";
import { canResend, canSignerSign, canVoid, isStatus, type SigningMode } from "@/lib/state";

export const metadata = { title: "Agreement" };

const EVENT_LABEL: Record<string, string> = {
  created: "Draft created",
  sent: "Sent for signature",
  resent: "New link issued",
  viewed: "Viewed",
  signed: "Signed",
  completed: "All parties signed",
  voided: "Voided",
  expired: "Expired",
};

export default async function AgreementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await expireOverdue(id);
  const a = await db.agreement.findUnique({
    where: { id },
    include: { signers: { orderBy: { order: "asc" } }, events: { orderBy: { createdAt: "asc" }, include: { signer: true } } },
  });
  if (!a) notFound();
  const status = isStatus(a.status) ? a.status : "draft";
  if (status === "completed" && !a.finalPdf) await finalizeAgreement(id);
  const pdfHash = a.finalPdfHash ?? (status === "completed" ? (await db.agreement.findUnique({ where: { id }, select: { finalPdfHash: true } }))?.finalPdfHash : null);
  const states = a.signers.map((s) => ({ id: s.id, order: s.order, signed: !!s.signedAt }));
  const mode = a.signingMode as SigningMode;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-700 hover:underline">← Agreements</Link>
          <h1 className="mt-1 text-2xl font-semibold">{a.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
            <StatusBadge status={status} />
            <span>{mode === "sequential" ? "Sequential signing" : "Parallel signing"}</span>
            {a.expiresAt && <span>Expires {fmtDateTime(a.expiresAt)}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {status === "completed" && (
            <a href={`/api/agreements/${a.id}/pdf`} className="btn btn-primary">Download signed PDF</a>
          )}
          {status === "draft" && (
            <>
              <Link href={`/agreements/${a.id}/edit`} className="btn">Edit</Link>
              <form action={deleteDraftAction}>
                <input type="hidden" name="id" value={a.id} />
                <button className="btn btn-danger">Delete</button>
              </form>
            </>
          )}
        </div>
      </div>

      {status === "draft" && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Ready to send?</h2>
          <SendButton id={a.id} />
        </div>
      )}

      {status === "voided" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Voided {fmtDateTime(a.voidedAt)}{a.voidReason ? `: ${a.voidReason}` : ""}
        </p>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">Signers</h2>
        <ul className="divide-y divide-gray-100">
          {a.signers.map((s) => {
            const open = canResend(status) && !s.signedAt;
            const myTurn = canSignerSign(mode, s.id, states);
            return (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{s.order}. {s.name}</p>
                  <p className="text-sm text-gray-600">{s.email}</p>
                </div>
                <div className="text-right text-sm">
                  {s.signedAt ? (
                    <span className="text-green-700">Signed {fmtDateTime(s.signedAt)}</span>
                  ) : status === "voided" || status === "expired" ? (
                    <span className="text-gray-500">{status === "voided" ? "Cancelled" : "Expired"}</span>
                  ) : status === "draft" ? (
                    <span className="text-gray-500">Not sent</span>
                  ) : open && !myTurn ? (
                    <span className="text-gray-500">Waiting for earlier signers</span>
                  ) : (
                    <span className="text-gray-600">{s.viewedAt ? `Viewed ${fmtDateTime(s.viewedAt)}` : "Awaiting signature"}</span>
                  )}
                  {open && myTurn && (
                    <div className="mt-2 flex justify-end">
                      <ResendButton id={a.id} signerId={s.id} label={s.tokenHash ? "Resend link" : "Get link"} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {canVoid(status) && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Void</h2>
          <VoidForm id={a.id} />
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">Document</h2>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm">{a.renderedBody ?? a.body}</pre>
        {a.docHash && (
          <p className="mt-3 break-all text-xs text-gray-600">
            Document SHA-256 (at send): <code>{a.docHash}</code>
          </p>
        )}
        {pdfHash && (
          <p className="mt-1 break-all text-xs text-gray-600">
            Signed PDF SHA-256: <code>{pdfHash}</code>
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">Audit timeline</h2>
        <ol className="relative space-y-4 border-l border-gray-200 pl-5">
          {a.events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
              <p className="text-sm font-medium">
                {EVENT_LABEL[e.type] ?? e.type}
                {e.signer ? <span className="font-normal text-gray-600"> - {e.signer.name}</span> : null}
              </p>
              <p className="text-xs text-gray-500">
                {fmtDateTime(e.createdAt)}
                {e.ip ? ` · IP ${e.ip}` : ""}
              </p>
              {e.userAgent && <p className="max-w-full truncate text-xs text-gray-400">{e.userAgent}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
