import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { truncate } from "../sanitize";

export interface PdfSigner {
  name: string;
  email: string;
  order: number;
  signedAt: Date | null;
  signatureType: string | null;
  signatureName: string | null;
  signatureImg: Uint8Array | null;
}

export interface PdfEvent {
  at: Date;
  type: string;
  actor: string;
  ip: string | null;
  userAgent: string | null;
}

export interface PdfInput {
  agreementId: string;
  title: string;
  body: string;
  docHash: string;
  sentAt: Date | null;
  completedAt: Date | null;
  signers: PdfSigner[];
  events: PdfEvent[];
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.82, 0.84, 0.87);

const REPLACEMENTS: [RegExp, string][] = [
  [/₹/g, "Rs."],
  [/[‘’‚]/g, "'"],
  [/[“”„]/g, '"'],
  [/[‐‑‒]/g, "-"],
  [/ | | /g, " "],
  [/\t/g, "    "],
];

/** Standard PDF fonts only cover WinAnsi; anything else is shown as "?". */
function encodable(text: string, font: PDFFont): string {
  let s = text;
  for (const [re, rep] of REPLACEMENTS) s = s.replace(re, rep);
  const set = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of s) out += set.has(ch.codePointAt(0)!) ? ch : "?";
  return out;
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly font: PDFFont,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensure(h: number) {
    if (this.y - h < MARGIN) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const para of encodable(text, font).split("\n")) {
      if (!para.trim()) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of para.split(/(?<= )/)) {
        const candidate = line + word;
        if (font.widthOfTextAtSize(candidate.trimEnd(), size) <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line.trimEnd());
        let rest = word;
        while (font.widthOfTextAtSize(rest.trimEnd(), size) > width) {
          let n = rest.length;
          while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > width) n--;
          lines.push(rest.slice(0, n));
          rest = rest.slice(n);
        }
        line = rest;
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }

  text(
    text: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {},
  ) {
    const font = opts.font ?? this.font;
    const size = opts.size ?? 10.5;
    const lead = size * 1.4;
    const indent = opts.indent ?? 0;
    for (const line of this.wrap(text, font, size, CONTENT_W - indent)) {
      this.ensure(lead);
      this.y -= lead;
      if (line) this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font, color: opts.color ?? INK });
    }
    this.y -= opts.gap ?? 0;
  }

  rule() {
    this.ensure(10);
    this.y -= 6;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.6, color: RULE });
    this.y -= 6;
  }
}

const fmt = (d: Date | null) => (d ? d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC") : "-");

export async function buildFinalPdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${encodableTitle(input.title)} (signed)`);
  doc.setProducer("Self-hosted E-Sign");
  doc.setCreator("Self-hosted E-Sign");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const w = new Writer(doc, font);

  // --- Agreement body ---
  w.text(input.title, { font: bold, size: 18, gap: 10 });
  w.text(input.body, { size: 10.5 });

  // --- Signature blocks ---
  w.y -= 18;
  w.ensure(60);
  w.text("Signatures", { font: bold, size: 13, gap: 4 });
  w.rule();
  for (const s of [...input.signers].sort((a, b) => a.order - b.order)) {
    const blockH = 96;
    w.ensure(blockH);
    const top = w.y;
    w.page.drawText(encodable(s.name, bold), { x: MARGIN, y: top - 14, size: 11, font: bold, color: INK });
    w.page.drawText(encodable(s.email, font), { x: MARGIN, y: top - 28, size: 9, font, color: MUTED });
    w.page.drawText(`Signed ${fmt(s.signedAt)}`, { x: MARGIN, y: top - 42, size: 9, font, color: MUTED });
    const how =
      s.signatureType === "drawn" ? "drawn signature" : s.signatureName ? `typed signature "${s.signatureName}"` : "";
    if (how) w.page.drawText(encodable(truncate(how, 70), font), { x: MARGIN, y: top - 54, size: 8.5, font, color: MUTED });
    if (s.signatureImg) {
      try {
        const img = await doc.embedPng(s.signatureImg);
        const scale = Math.min(200 / img.width, 56 / img.height);
        w.page.drawImage(img, { x: PAGE_W - MARGIN - 220, y: top - 66, width: img.width * scale, height: img.height * scale });
      } catch {
        /* unreadable image: the name and timestamp above still stand */
      }
    }
    w.page.drawLine({
      start: { x: PAGE_W - MARGIN - 220, y: top - 70 },
      end: { x: PAGE_W - MARGIN, y: top - 70 },
      thickness: 0.6,
      color: MUTED,
    });
    w.y = top - blockH;
  }

  // --- Certificate of Completion ---
  w.newPage();
  w.text("Certificate of Completion", { font: bold, size: 20, gap: 6 });
  w.text("This certificate records the electronic signing of the document above.", { color: MUTED, gap: 8 });
  w.rule();
  const kv = (k: string, v: string, monoValue = false) => {
    w.text(k, { font: bold, size: 9, color: MUTED });
    w.y += 2;
    w.text(v, { font: monoValue ? mono : font, size: monoValue ? 8.5 : 10, gap: 4 });
  };
  kv("Document", input.title);
  kv("Agreement ID", input.agreementId, true);
  kv("Document SHA-256 (recorded when sent)", input.docHash, true);
  kv("Sent", fmt(input.sentAt));
  kv("Completed", fmt(input.completedAt));

  w.y -= 6;
  w.text("Signers", { font: bold, size: 12, gap: 2 });
  w.rule();
  for (const s of [...input.signers].sort((a, b) => a.order - b.order)) {
    w.text(`${s.order}. ${s.name} <${s.email}>`, { font: bold, size: 10 });
    w.text(`Signed ${fmt(s.signedAt)} (${s.signatureType ?? "n/a"})`, { size: 9, color: MUTED, indent: 12, gap: 3 });
  }

  w.y -= 8;
  w.text("Audit trail", { font: bold, size: 12, gap: 2 });
  w.rule();
  for (const ev of input.events) {
    w.text(`${fmt(ev.at)}  |  ${ev.type.toUpperCase()}  |  ${ev.actor}`, { font: bold, size: 8.5 });
    const net = [ev.ip ? `IP ${ev.ip}` : null, ev.userAgent ? `UA ${truncate(ev.userAgent, 110)}` : null]
      .filter(Boolean)
      .join("   ");
    w.text(net || "-", { size: 8, color: MUTED, indent: 12, gap: 4 });
  }

  w.y -= 8;
  w.ensure(60);
  w.text(
    'Document hash: SHA-256 of the UTF-8 JSON {"v":1,"title":<title>,"body":<text with variables filled>}. ' +
      "The SHA-256 of this PDF file is stored by the issuer and shown in the dashboard. " +
      "This is a simple electronic signature; it is not an Aadhaar eSign or qualified electronic signature.",
    { size: 8, color: MUTED },
  );

  // Footer on every page.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Agreement ${input.agreementId}  -  page ${i + 1} of ${pages.length}`, {
      x: MARGIN,
      y: 28,
      size: 7.5,
      font,
      color: MUTED,
    });
  });

  return doc.save();
}

function encodableTitle(title: string): string {
  return title.replace(/[^\x20-\x7E]/g, "?");
}
