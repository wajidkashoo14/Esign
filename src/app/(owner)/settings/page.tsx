import { TestEmailButton, TwoStepSetup } from "@/components/SettingsWidgets";
import { IconCheck, IconX } from "@/components/Icons";
import { emailProvider, env, signerOtpRequired, totpEnabled } from "@/lib/server/env";
import { sealInfo } from "@/lib/server/seal";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Settings" };

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ok ? "bg-green-50 text-green-700 ring-green-200" : "bg-gray-100 text-gray-600 ring-gray-200"}`}>
      {ok ? <IconCheck className="h-3 w-3" /> : <IconX className="h-3 w-3" />}
      {children}
    </span>
  );
}

function Section({ title, status, children }: { title: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="card-title">{title}</h2>
        {status}
      </div>
      <div className="space-y-3 text-sm text-gray-600">{children}</div>
    </section>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800">{children}</code>;

export default function SettingsPage() {
  const e = env();
  const provider = emailProvider();
  let seal: ReturnType<typeof sealInfo> = null;
  let sealError: string | null = null;
  try {
    seal = sealInfo();
  } catch (err) {
    sealError = err instanceof Error ? err.message : "Invalid seal certificate";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500">
          Settings come from environment variables. In Vercel: <strong>Settings → Environment Variables</strong>, then redeploy.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Email delivery" status={<Status ok={provider !== "none"}>{provider === "none" ? "Not set up" : provider === "resend" ? "Resend" : "SMTP"}</Status>}>
          {provider === "none" ? (
            <>
              <p>Signers aren’t emailed: you copy each link yourself. To send emails automatically with Resend:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Create a free account at resend.com and add your domain under <strong>Domains</strong>.</li>
                <li>Add the DNS records Resend shows (at your domain registrar) and wait until the domain says <em>Verified</em>.</li>
                <li>Create an API key under <strong>API Keys</strong>.</li>
                <li>
                  Set <Code>RESEND_API_KEY</Code> and <Code>EMAIL_FROM</Code> (for example <Code>Your Name &lt;sign@yourdomain.com&gt;</Code>), then redeploy.
                </li>
              </ol>
            </>
          ) : (
            <>
              <p>
                Sending as <Code>{e.EMAIL_FROM}</Code>. Replies go to <Code>{e.OWNER_EMAIL}</Code>.
              </p>
              <TestEmailButton />
            </>
          )}
        </Section>

        <Section title="Signer email verification" status={<Status ok={signerOtpRequired()}>{signerOtpRequired() ? "On" : "Off"}</Status>}>
          <p>
            When on, each signer must enter a 6-digit code emailed to them before they can sign. This proves they control the invited address,
            even if the link is forwarded.
          </p>
          <p>
            Mode: <Code>SIGNER_EMAIL_OTP={e.SIGNER_EMAIL_OTP}</Code>.{" "}
            {e.SIGNER_EMAIL_OTP === "auto" && "It turns on automatically once email delivery is set up."}
            {e.SIGNER_EMAIL_OTP === "on" && provider === "none" && <span className="text-amber-700"> Email isn’t set up, so signers can’t receive codes.</span>}
          </p>
        </Section>

        <Section
          title="PDF seal"
          status={<Status ok={!!seal}>{seal ? "Active" : sealError ? "Error" : "Not set up"}</Status>}
        >
          <p>A seal is a digital signature on the final PDF. Adobe Acrobat Reader then reports any change made after signing.</p>
          {sealError && <p className="alert-error">{sealError}</p>}
          {seal ? (
            <p>
              Sealing as <Code>{seal.name}</Code>, certificate valid until {fmtDate(seal.notAfter)}.
            </p>
          ) : (
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                In PowerShell, in the project folder, run <Code>npm run make-seal-cert -- &quot;Your Company&quot;</Code>.
              </li>
              <li>
                Add the printed <Code>PDF_SEAL_P12_PASSWORD</Code> and <Code>PDF_SEAL_P12_BASE64</Code> variables, then redeploy.
              </li>
            </ol>
          )}
          <p className="text-xs text-gray-500">
            A self-signed seal proves the file wasn’t changed. For readers to also show your identity as “trusted”, use a document-signing
            certificate from a certificate authority instead.
          </p>
        </Section>

        <Section title="Two-step login" status={<Status ok={totpEnabled()}>{totpEnabled() ? "On" : "Off"}</Status>}>
          {totpEnabled() ? (
            <p>
              Signing in requires your password and a code from your authenticator app. To turn it off or move to a new phone, remove or replace{" "}
              <Code>OWNER_TOTP_SECRET</Code> and redeploy.
            </p>
          ) : (
            <>
              <p>Protect your account with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, ...).</p>
              <TwoStepSetup />
            </>
          )}
        </Section>

        <Section title="Account" status={<Status ok>Owner</Status>}>
          <p>
            Signed in as <Code>{e.OWNER_EMAIL}</Code>. Change the password by generating a new hash with{" "}
            <Code>npm run hash-password -- &apos;new password&apos;</Code> and updating <Code>OWNER_PASSWORD_HASH</Code>.
          </p>
          <p>
            Public address: <Code>{e.APP_URL ?? "not set (APP_URL)"}</Code>
          </p>
        </Section>
      </div>
    </div>
  );
}
