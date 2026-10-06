import nodemailer from "nodemailer";
import { escapeHtml } from "../sanitize";
import { emailProvider, env } from "./env";
import { log } from "./log";

export interface Attachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface Mail {
  to: string;
  subject: string;
  /** Short heading shown at the top of the HTML email. */
  heading?: string;
  text: string;
  /** Optional call-to-action rendered as a button in the HTML version. */
  action?: { label: string; url: string };
  /** Optional one-time code, shown large in the HTML version. */
  code?: string;
  attachments?: Attachment[];
  /** Opaque id used only for log correlation (e.g. signer id). */
  ref: string;
}

export interface SendResult {
  delivered: boolean;
  provider: "resend" | "smtp" | "none";
  /** Provider error summary (status code / provider message). Never contains recipient data. */
  error?: string;
}

/** Messages captured instead of sent when NODE_ENV=test and no provider is configured. */
export const testOutbox: Mail[] = [];

function renderHtml(mail: Mail): string {
  const paragraphs = mail.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const code = mail.code
    ? `<p style="margin:20px 0;font-size:32px;letter-spacing:8px;font-weight:700;font-family:Consolas,Menlo,monospace;color:#111827">${escapeHtml(mail.code)}</p>`
    : "";
  const button = mail.action
    ? `<p style="margin:24px 0 8px"><a href="${escapeHtml(mail.action.url)}" style="background:#1d4ed8;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(mail.action.label)}</a></p>
       <p style="color:#6b7280;font-size:12px;word-break:break-all;margin:0 0 8px">${escapeHtml(mail.action.url)}</p>`
    : "";
  const heading = mail.heading
    ? `<h1 style="font-size:20px;margin:0 0 16px;color:#111827">${escapeHtml(mail.heading)}</h1>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px 12px">
<div style="max-width:560px;margin:0 auto;font-family:system-ui,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#1f2937">
  <div style="padding:0 4px 12px;font-weight:700;color:#1d4ed8;font-size:16px">E-Sign</div>
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 24px">${heading}${paragraphs}${code}${button}</div>
  <p style="color:#9ca3af;font-size:12px;padding:12px 4px;margin:0">You received this because someone requested your electronic signature. If you weren't expecting it, you can ignore this email.</p>
</div></body></html>`;
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  const provider = emailProvider();
  const e = env();
  const extras = [mail.code ? `Your code: ${mail.code}` : "", mail.action ? `${mail.action.label}: ${mail.action.url}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const text = extras ? `${mail.text}\n\n${extras}` : mail.text;
  const html = renderHtml(mail);

  try {
    if (provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: e.EMAIL_FROM,
          to: [mail.to],
          reply_to: e.OWNER_EMAIL,
          subject: mail.subject,
          text,
          html,
          attachments: mail.attachments?.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content).toString("base64"),
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        const detail = `Resend HTTP ${res.status}${body?.message ? `: ${body.message.slice(0, 200)}` : ""}`;
        throw Object.assign(new Error(detail), { code: `HTTP_${res.status}`, detail });
      }
      return { delivered: true, provider };
    }

    if (provider === "smtp") {
      const transport = nodemailer.createTransport({
        host: e.SMTP_HOST,
        port: e.SMTP_PORT,
        secure: e.SMTP_SECURE === "true",
        auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
      });
      await transport.sendMail({
        from: e.EMAIL_FROM,
        replyTo: e.OWNER_EMAIL,
        to: mail.to,
        subject: mail.subject,
        text,
        html,
        attachments: mail.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content),
          contentType: a.contentType,
        })),
      });
      return { delivered: true, provider };
    }
  } catch (err) {
    log.error("email.failed", err, { provider, ref: mail.ref });
    const detail =
      (err as { detail?: string }).detail ??
      `${provider.toUpperCase()} error${(err as { code?: string }).code ? ` (${(err as { code?: string }).code})` : ""}`;
    return { delivered: false, provider, error: detail };
  }

  // No provider configured: nothing is sent. Recipient addresses are never logged.
  if (process.env.NODE_ENV === "test") {
    testOutbox.push(mail);
    return { delivered: false, provider: "none" };
  }
  log.info("email.not_configured", { ref: mail.ref, subject: mail.subject });
  if (process.env.NODE_ENV !== "production") {
    // Development convenience so the flow can be tested from the terminal.
    if (mail.action) console.log(`[dev] link for ${mail.ref}: ${mail.action.url}`);
    if (mail.code) console.log(`[dev] code for ${mail.ref}: ${mail.code}`);
  }
  return { delivered: false, provider: "none" };
}
