// fontkit's Indic (Devanagari) shaper uses generator code compiled for a global regeneratorRuntime.
import "regenerator-runtime/runtime";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { parseDocument, type Inline } from "../markdown";
import { truncate } from "../sanitize";
import { loadFontFiles } from "./fonts";

export interface PdfSigner {
  name: string;
  email: string;
  order: number;
  signedAt: Date | null;
  signatureType: string | null;
  signatureName: string | null;
  signatureImg: Uint8Array | null;
  otpVerifiedAt: Date | null;
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
  /** Name on the sealing certificate, when the PDF will be digitally sealed after build. */
  sealedBy?: string | null;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.82, 0.84, 0.87);
const ACCENT = rgb(0.11, 0.3, 0.85);

// ------------------------------------------------------------------ fonts & text runs

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  devaRegular: PDFFont;
  devaBold: PDFFont;
  mono: PDFFont;
}

interface Piece {
  text: string;
  font: PDFFont;
}

const DEVANAGARI = /[ऀ-ॿ꣠-ꣿ᳐-᳿]/;
const JOINERS = /[‌‍]/;

class FontSet {
  private sets = new Map<PDFFont, Set<number>>();
  constructor(readonly f: Fonts) {}

  private has(font: PDFFont, cp: number): boolean {
    let s = this.sets.get(font);
    if (!s) this.sets.set(font, (s = new Set(font.getCharacterSet())));
    return s.has(cp);
  }

  /** Split text into runs that each use one font: Devanagari letters use Noto Sans Devanagari, the rest Noto Sans. */
  pieces(text: string, bold: boolean): Piece[] {
    const latin = bold ? this.f.bold : this.f.regular;
    const deva = bold ? this.f.devaBold : this.f.devaRegular;
    const out: Piece[] = [];
    let cur: Piece | null = null;
    for (const raw of text.replace(/\t/g, "    ")) {
      const cp = raw.codePointAt(0)!;
      let font: PDFFont;
      let ch = raw;
      if (JOINERS.test(raw)) font = cur?.font ?? latin;
      else if (DEVANAGARI.test(raw)) font = this.has(deva, cp) ? deva : latin;
      else font = latin;
      if (!JOINERS.test(raw) && raw !== "\n" && !this.has(font, cp)) {
        ch = "?"; // character not covered by the embedded fonts
        font = latin;
      }
      if (cur && cur.font === font) cur.text += ch;
      else out.push((cur = { text: ch, font }));
    }
    return out;
  }
}

// ------------------------------------------------------------------ line layout

interface Atom {
  kind: "word" | "space" | "break";
  text: string;
  font: PDFFont;
  width: number;
}

const graphemes = (s: string) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].map((g) => g.segment);
const sum = (atoms: Atom[]) => atoms.reduce((n, a) => n + a.width, 0);

function atomize(pieces: Piece[], size: number): Atom[] {
  const atoms: Atom[] = [];
  for (const p of pieces) {
    for (const m of p.text.matchAll(/\n|[^\S\n]+|\S+/g)) {
      const t = m[0];
      if (t === "\n") atoms.push({ kind: "break", text: "", font: p.font, width: 0 });
      else atoms.push({ kind: /^\s/.test(t) ? "space" : "word", text: t, font: p.font, width: p.font.widthOfTextAtSize(t, size) });
    }
  }
  return atoms;
}

/** Greedy line breaking; words never split unless a single word is wider than the line. */
function layout(atoms: Atom[], maxWidth: number, size: number): Atom[][] {
  const lines: Atom[][] = [];
  let line: Atom[] = [];
  let width = 0;
  let spaces: Atom[] = [];
  const pushLine = () => {
    lines.push(line);
    line = [];
    width = 0;
    spaces = [];
  };
  let i = 0;
  while (i < atoms.length) {
    const a = atoms[i]!;
    if (a.kind === "break") {
      pushLine();
      i++;
      continue;
    }
    if (a.kind === "space") {
      if (line.length) spaces.push(a);
      i++;
      continue;
    }
    const group: Atom[] = [];
    while (i < atoms.length && atoms[i]!.kind === "word") group.push(atoms[i++]!);
    const gw = sum(group);
    if (line.length && width + sum(spaces) + gw > maxWidth) pushLine();
    line.push(...spaces);
    width += sum(spaces);
    spaces = [];
    if (width + gw <= maxWidth) {
      line.push(...group);
      width += gw;
      continue;
    }
    for (const g of group) {
      for (const ch of graphemes(g.text)) {
        const cw = g.font.widthOfTextAtSize(ch, size);
        if (line.length && width + cw > maxWidth) pushLine();
        line.push({ kind: "word", text: ch, font: g.font, width: cw });
        width += cw;
      }
    }
  }
  if (line.length || !lines.length) lines.push(line);
  return lines;
}

function drawLine(page: PDFPage, line: Atom[], x: number, y: number, size: number, color: RGB) {
  let i = 0;
  while (i < line.length) {
    const font = line[i]!.font;
    let text = "";
    while (i < line.length && line[i]!.font === font) text += line[i++]!.text;
    if (text.trim()) page.drawText(text, { x, y, size, font, color });
    x += font.widthOfTextAtSize(text, size);
  }
}

// ------------------------------------------------------------------ writer

interface TextOpts {
  size?: number;
  bold?: boolean;
  color?: RGB;
  indent?: number;
  gap?: number;
  /** Text drawn in the left gutter of the first line (list markers). */
  marker?: string;
  markerWidth?: number;
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly fonts: FontSet,
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

  rich(inlines: Inline[], o: TextOpts = {}) {
    const size = o.size ?? 10.5;
    const lead = size * 1.5;
    const indent = (o.indent ?? 0) + (o.markerWidth ?? 0);
    const pieces = inlines.flatMap((r) => this.fonts.pieces(r.text, o.bold || r.bold));
    const lines = layout(atomize(pieces, size), CONTENT_W - indent, size);
    lines.forEach((line, n) => {
      this.ensure(lead);
      this.y -= lead;
      if (n === 0 && o.marker) {
        drawLine(this.page, atomize(this.fonts.pieces(o.marker, !!o.bold), size), MARGIN + (o.indent ?? 0), this.y, size, o.color ?? INK);
      }
      drawLine(this.page, line, MARGIN + indent, this.y, size, o.color ?? INK);
    });
    this.y -= o.gap ?? 0;
  }

  text(text: string, o: TextOpts = {}) {
    this.rich([{ text, bold: false }], o);
  }

  mono(text: string, size = 8.5) {
    const font = this.fonts.f.mono;
    const perLine = Math.floor(CONTENT_W / font.widthOfTextAtSize("0", size));
    for (let i = 0; i < text.length; i += perLine) {
      this.ensure(size * 1.5);
      this.y -= size * 1.5;
      this.page.drawText(text.slice(i, i + perLine).replace(/[^\x20-\x7E]/g, "?"), { x: MARGIN, y: this.y, size, font, color: INK });
    }
  }

  rule(color = RULE) {
    this.ensure(14);
    this.y -= 7;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.6, color });
    this.y -= 7;
  }

  /** Draw a short single-line string at a fixed position (used inside signature blocks). */
  at(text: string, x: number, y: number, size: number, bold = false, color: RGB = INK, maxWidth = CONTENT_W) {
    const line = layout(atomize(this.fonts.pieces(text, bold), size), maxWidth, size)[0] ?? [];
    drawLine(this.page, line, x, y, size, color);
  }

  document(source: string) {
    for (const block of parseDocument(source)) {
      switch (block.type) {
        case "heading": {
          const size = block.level === 1 ? 16 : block.level === 2 ? 13 : 11.5;
          this.ensure(size * 1.5 + 40); // keep headings with the text that follows
          this.y -= block.level === 1 ? 10 : 6;
          this.rich(block.content, { size, bold: true, gap: 3 });
          break;
        }
        case "paragraph":
          this.rich(block.content, { gap: 7 });
          break;
        case "list": {
          const size = 10.5;
          const markerWidth = Math.max(...block.items.map((i) => this.fonts.f.regular.widthOfTextAtSize(i.marker, size))) + 8;
          for (const item of block.items) this.rich(item.content, { marker: item.marker, markerWidth, indent: 6, gap: 3 });
          this.y -= 4;
          break;
        }
        case "hr":
          this.rule();
          break;
      }
    }
  }
}

const fmt = (d: Date | null) => (d ? d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC") : "-");

// ------------------------------------------------------------------ document

export async function createFinalPdf(input: PdfInput): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${input.title} (signed)`);
  doc.setProducer("Self-hosted E-Sign");
  doc.setCreator("Self-hosted E-Sign");
  const files = await loadFontFiles();
  const fonts = new FontSet({
    regular: await doc.embedFont(files.regular, { subset: true }),
    bold: await doc.embedFont(files.bold, { subset: true }),
    devaRegular: await doc.embedFont(files.devaRegular, { subset: true }),
    devaBold: await doc.embedFont(files.devaBold, { subset: true }),
    mono: await doc.embedFont(StandardFonts.Courier),
  });
  const w = new Writer(doc, fonts);
  const signers = [...input.signers].sort((a, b) => a.order - b.order);

  // --- Agreement ---
  w.text(input.title, { size: 19, bold: true, gap: 4 });
  w.rule(ACCENT);
  w.y -= 4;
  w.document(input.body);

  // --- Signature blocks ---
  w.y -= 14;
  w.ensure(130);
  w.text("Signatures", { size: 13, bold: true, gap: 2 });
  w.rule();
  for (const s of signers) {
    const blockH = 100;
    w.ensure(blockH);
    const top = w.y;
    const left = 250;
    w.at(s.name, MARGIN, top - 16, 11, true, INK, left - 10);
    w.at(s.email, MARGIN, top - 30, 9, false, MUTED, left - 10);
    w.at(`Signed ${fmt(s.signedAt)}`, MARGIN, top - 44, 9, false, MUTED, left - 10);
    const how =
      s.signatureType === "drawn" ? "Drawn signature" : s.signatureName ? `Typed signature: ${truncate(s.signatureName, 40)}` : "";
    if (how) w.at(how, MARGIN, top - 57, 8.5, false, MUTED, left - 10);
    w.at(s.otpVerifiedAt ? "Email verified with one-time code" : "Verified by personal email link", MARGIN, top - 70, 8.5, false, MUTED, left - 10);
    if (s.signatureImg) {
      try {
        const img = await doc.embedPng(s.signatureImg);
        const scale = Math.min(210 / img.width, 60 / img.height);
        w.page.drawImage(img, { x: PAGE_W - MARGIN - 225, y: top - 72, width: img.width * scale, height: img.height * scale });
      } catch {
        /* unreadable image: the name and timestamp still stand */
      }
    }
    w.page.drawLine({ start: { x: PAGE_W - MARGIN - 225, y: top - 76 }, end: { x: PAGE_W - MARGIN, y: top - 76 }, thickness: 0.6, color: MUTED });
    w.y = top - blockH;
  }

  // --- Certificate of Completion ---
  w.newPage();
  w.text("Certificate of Completion", { size: 20, bold: true, gap: 2 });
  w.text("This certificate records the electronic signing of the document above.", { color: MUTED, size: 10 });
  w.rule(ACCENT);
  const kv = (k: string, v: string, mono = false) => {
    w.ensure(32);
    w.text(k, { size: 8.5, bold: true, color: MUTED });
    if (mono) w.mono(v);
    else w.text(v, { size: 10 });
    w.y -= 5;
  };
  kv("Document", input.title);
  kv("Agreement ID", input.agreementId, true);
  kv("Document SHA-256 (recorded when sent)", input.docHash, true);
  kv("Sent", fmt(input.sentAt));
  kv("Completed", fmt(input.completedAt));
  kv(
    "Integrity",
    input.sealedBy
      ? `This PDF is digitally sealed by "${input.sealedBy}". Open it in Adobe Acrobat Reader and check the signature panel: any change to the file after sealing is reported.`
      : "This PDF is not digitally sealed. Compare its SHA-256 with the value stored by the sender to confirm it is unchanged.",
  );

  w.y -= 4;
  w.text("Signers", { size: 12, bold: true });
  w.rule();
  for (const s of signers) {
    w.ensure(50);
    w.text(`${s.order}. ${s.name} <${s.email}>`, { size: 10, bold: true });
    w.text(
      `Signed ${fmt(s.signedAt)} - ${s.signatureType ?? "n/a"} signature - ${
        s.otpVerifiedAt ? `email verified by one-time code at ${fmt(s.otpVerifiedAt)}` : "identified by personal email link"
      }`,
      { size: 9, color: MUTED, indent: 14, gap: 4 },
    );
  }

  w.y -= 6;
  w.text("Audit trail", { size: 12, bold: true });
  w.rule();
  for (const ev of input.events) {
    w.ensure(34);
    w.text(`${fmt(ev.at)}   ${ev.type.toUpperCase().replace("_", " ")}   ${ev.actor}`, { size: 8.5, bold: true });
    const net = [ev.ip ? `IP ${ev.ip}` : null, ev.userAgent ? `Browser ${truncate(ev.userAgent, 120)}` : null]
      .filter(Boolean)
      .join("   ");
    w.text(net || "-", { size: 7.5, color: MUTED, indent: 14, gap: 3 });
  }

  w.y -= 10;
  w.ensure(60);
  w.text(
    'Document hash: SHA-256 of the UTF-8 JSON {"v":1,"title":<title>,"body":<text with variables filled>}. ' +
      "The SHA-256 of this PDF file is stored by the sender. " +
      "This is a simple electronic signature; it is not an Aadhaar eSign, DSC or qualified electronic signature.",
    { size: 7.5, color: MUTED },
  );

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Agreement ${input.agreementId}  -  page ${i + 1} of ${pages.length}`, {
      x: MARGIN,
      y: 28,
      size: 7.5,
      font: fonts.f.regular,
      color: MUTED,
    });
  });
  return doc;
}

export async function buildFinalPdf(input: PdfInput): Promise<Uint8Array> {
  return (await createFinalPdf(input)).save();
}
