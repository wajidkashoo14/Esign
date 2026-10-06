import type { Metadata } from "next";
import { AgreementBody } from "@/components/AgreementBody";
import { IconBan, IconCheck, IconClock, IconDownload, IconLock, IconX, Logo } from "@/components/Icons";
import { SigningPanel } from "@/components/SigningPanel";
import { fmtDateTime } from "@/lib/format";
import { loadSigningView } from "@/lib/server/agreements";
import { clientInfo } from "@/lib/server/request";
import { isSignerVerified } from "@/lib/server/signer-session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = { title: "Review and sign", robots: { index: false, follow: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <IconLock className="h-3.5 w-3.5" /> Secure signing
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}

function Notice({ icon, tone, title, children }: { icon: React.ReactNode; tone: string; title: string; children?: React.ReactNode }) {
  return (
    <Shell>
      <div className="card mx-auto mt-6 max-w-md text-center">
        <span className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full ${tone}`}>{icon}</span>
        <h1 className="text-xl font-semibold">{title}</h1>
        {children && <div className="mt-2 text-sm text-gray-600">{children}</div>}
      </div>
    </Shell>
  );
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadSigningView(token, await clientInfo());

  if (view.kind === "invalid") {
    return (
      <Notice icon={<IconBan className="h-6 w-6" />} tone="bg-gray-100 text-gray-600" title="This link doesn't work">
        It may have been replaced by a newer link, or the request was cancelled. Ask the sender for a new link.
      </Notice>
    );
  }
  if (view.status === "voided") {
    return (
      <Notice icon={<IconBan className="h-6 w-6" />} tone="bg-gray-100 text-gray-600" title="This request was cancelled">
        {view.voidReason ? `The sender's note: ${view.voidReason}` : "The sender cancelled this signature request. You don't need to do anything."}
      </Notice>
    );
  }
  if (view.status === "expired") {
    return (
      <Notice icon={<IconClock className="h-6 w-6" />} tone="bg-orange-100 text-orange-700" title="This request has expired">
        Signing closed {view.expiresAt ? `on ${fmtDateTime(view.expiresAt)}` : ""}. Ask the sender to send it again.
      </Notice>
    );
  }

  const verified = view.otpRequired ? await isSignerVerified(view.tokenHash) : true;
  const done = !!view.signedAt;
  const steps = view.otpRequired ? ["Read", "Verify email", "Sign"] : ["Read", "Sign"];
  const step = view.otpRequired && verified ? 3 : 2;

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-gray-500">Hello {view.signerName},</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight break-words sm:text-3xl">{view.title}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {view.signedCount} of {view.totalSigners} signed
            {view.expiresAt && view.status !== "completed" ? ` · Please sign before ${fmtDateTime(view.expiresAt)}` : ""}
          </p>
        </div>

        {view.status === "completed" && (
          <div className="card flex flex-col gap-4 border-green-200 bg-green-50/60 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-green-600 text-white">
                <IconCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-green-900">Everyone has signed</p>
                <p className="text-sm text-green-800">Download your copy with the Certificate of Completion.</p>
              </div>
            </div>
            <a href={`/sign/${token}/pdf`} className="btn btn-primary">
              <IconDownload /> Download signed PDF
            </a>
          </div>
        )}
        {view.status === "declined" && (
          <div className="card flex items-start gap-3 border-rose-200 bg-rose-50/60">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-rose-100 text-rose-700">
              <IconX className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-rose-900">{view.declinedAt ? "You declined to sign" : "This agreement was declined"}</p>
              <p className="text-sm text-rose-800">
                {view.declinedAt ? `Recorded on ${fmtDateTime(view.declinedAt)}. The sender has been told.` : "Another signer declined, so the request is closed. You don't need to do anything."}
              </p>
            </div>
          </div>
        )}
        {done && view.status !== "completed" && (
          <div className="card flex items-start gap-3 border-green-200 bg-green-50/60">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-green-600 text-white">
              <IconCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-green-900">You signed on {fmtDateTime(view.signedAt)}</p>
              <p className="text-sm text-green-800">You’ll get the completed document by email once everyone has signed. This link will also let you download it.</p>
            </div>
          </div>
        )}

        {(view.canSign || view.waitingForOthers) && (
          <ol className={`grid gap-2 text-xs sm:text-sm ${steps.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} aria-label="Progress">
            {steps.map((label, i) => {
              const n = i + 1;
              const state = n < step ? "done" : n === step ? "now" : "todo";
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                    state === "now" ? "bg-blue-700 text-white" : state === "done" ? "bg-blue-50 text-blue-800" : "bg-white text-gray-500 ring-1 ring-gray-200"
                  }`}
                >
                  <span className="font-semibold">{state === "done" ? "✓" : n}</span>
                  <span className="truncate">{label}</span>
                </li>
              );
            })}
          </ol>
        )}

        <article className="card !px-5 sm:!px-10 sm:!py-9">
          <AgreementBody text={view.body} />
          <p className="mt-6 border-t border-gray-100 pt-3 font-mono text-[11px] break-all text-gray-400">
            Document fingerprint (SHA-256): {view.docHash}
          </p>
        </article>

        {view.waitingForOthers && (
          <div className="alert-warn">
            <p className="font-medium">It’s not your turn yet</p>
            <p className="mt-0.5">You can read the document now. You’ll get an email when it’s your turn to sign.</p>
          </div>
        )}

        {view.canSign && (
          <SigningPanel token={token} defaultName={view.signerName} maskedEmail={view.maskedEmail} needsCode={!verified} />
        )}
      </div>
    </Shell>
  );
}
