import type { Metadata } from "next";
import { SignForm } from "@/components/SignForm";
import { fmtDateTime } from "@/lib/format";
import { loadSigningView } from "@/lib/server/agreements";
import { clientInfo } from "@/lib/server/request";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review and sign", robots: { index: false, follow: false } };

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto mt-24 max-w-md px-4">
      <div className="card text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        {children && <p className="mt-2 text-sm text-gray-600">{children}</p>}
      </div>
    </main>
  );
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadSigningView(token, await clientInfo());

  if (view.kind === "invalid") {
    return <Notice title="This link is not valid">It may have been replaced by a newer link or cancelled. Ask the sender for a new one.</Notice>;
  }
  if (view.status === "voided") return <Notice title="This agreement was cancelled">{view.voidReason ?? "The sender cancelled this request."}</Notice>;
  if (view.status === "expired") return <Notice title="This agreement has expired">Ask the sender to send it again.</Notice>;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <p className="text-sm text-gray-500">Hello {view.signerName}</p>
        <h1 className="text-2xl font-semibold">{view.title}</h1>
        {view.expiresAt && <p className="mt-1 text-sm text-gray-500">Sign before {fmtDateTime(view.expiresAt)}</p>}
      </header>

      <article className="card">
        <pre className="whitespace-pre-wrap break-words font-serif text-[15px] leading-relaxed">{view.body}</pre>
        <p className="mt-4 break-all border-t border-gray-100 pt-3 text-xs text-gray-500">
          Document fingerprint (SHA-256): <code>{view.docHash}</code>
        </p>
      </article>

      {view.signedAt ? (
        <div className="card border-green-200 bg-green-50 text-green-900">
          <p className="font-medium">You signed this on {fmtDateTime(view.signedAt)}.</p>
          <p className="mt-1 text-sm">
            {view.status === "completed"
              ? "All parties have signed. The completed document has been emailed to everyone."
              : "You will receive the completed document by email once everyone has signed."}
          </p>
        </div>
      ) : view.waitingForOthers ? (
        <div className="card border-amber-200 bg-amber-50 text-amber-900">
          <p className="font-medium">Waiting for earlier signers</p>
          <p className="mt-1 text-sm">You can read the document now. Signing opens when it is your turn.</p>
        </div>
      ) : view.canSign ? (
        <SignForm token={token} defaultName={view.signerName} />
      ) : null}
    </main>
  );
}
