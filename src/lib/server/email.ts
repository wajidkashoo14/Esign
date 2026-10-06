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
  text: string;
  /** Optional call-to-action rendered as a button in the HTML version. */
  action?: { label: string; url: string };
  attachments?: Attachment[];
  /** Opaque id used only for log correlation (e.g. signer id). */
  ref: string;
}

export interface SendResult {
  delivered: boolean;
  provider: "resend" | "smtp" | "none";
}

function renderHtml(mail: Mail): string {
  const paragraphs = mail.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = mail.action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(mail.action.url)}" style="background:#1d4ed8;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(mail.action.label)}</a></p>
       <p style="color:#6b7280;font-size:12px;word-break:break-all">${escapeHtml(mail.action.url)}</p>`
    : "";
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;color:#111827;max-width:560px">${paragraphs}${button}</div>`;
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  const provider = emailProvider();
  const e = env();
  const text = mail.action ? `${mail.text}\n\n${mail.action.label}: ${mail.action.url}` : mail.text;
  const html = renderHtml(mail);

  try {
    if (provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: e.EMAIL_FROM,
          to: [mail.to],
          subject: mail.subject,
          text,
          html,
          attachments: mail.attachments?.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content).toString("base64"),
          })),
        }),
      });
      if (!res.ok) throw Object.assign(new Error("resend failed"), { code: `HTTP_${res.status}` });
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
    return { delivered: false, provider };
  }

  // No provider configured: do not send. Recipient addresses are never logged.
  // In development the link is printed so the flow can be tested from the terminal.
  log.info("email.not_configured", { ref: mail.ref, subject: mail.subject });
  if (process.env.NODE_ENV !== "production" && mail.action) {
    console.log(`[dev] link for ${mail.ref}: ${mail.action.url}`);
  }
  return { delivered: false, provider: "none" };
}
