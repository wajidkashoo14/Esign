/**
 * A deliberately small, safe Markdown subset for agreement text. The output is a
 * plain data structure (never HTML), rendered by React on the web and by pdf-lib in
 * the final PDF, so both always show the same document.
 *
 *   # Heading / ## Heading / ### Heading
 *   **bold**
 *   1. numbered item        - bullet item
 *   ---                      (horizontal line)
 *
 * Blank lines separate paragraphs; single line breaks are kept as line breaks.
 */

export interface Inline {
  text: string;
  bold: boolean;
}

export interface ListItem {
  marker: string;
  content: Inline[];
}

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "hr" };

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const ORDERED = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/;
const BULLET = /^\s{0,3}[-*•]\s+(.*)$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const BOLD = /\*\*(?=\S)(.+?)(?<=\S)\*\*/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(BOLD)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out;
}

export function parseDocument(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: { marker: string; raw: string }[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", content: parseInline(para.join("\n")) });
    para = [];
  };
  const flushList = () => {
    if (list) {
      blocks.push({
        type: "list",
        ordered: list.ordered,
        items: list.items.map((i) => ({ marker: i.marker, content: parseInline(i.raw) })),
      });
    }
    list = null;
  };

  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (HR.test(line)) {
      flushPara();
      flushList();
      blocks.push({ type: "hr" });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: "heading", level: h[1]!.length as 1 | 2 | 3, content: parseInline(h[2]!) });
      continue;
    }
    const o = ORDERED.exec(line);
    const b = o ? null : BULLET.exec(line);
    if (o || b) {
      flushPara();
      const ordered = !!o;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push({ marker: o ? `${o[1]}.` : "•", raw: (o ? o[2] : b![1])! });
      continue;
    }
    // An indented line directly under a list item continues that item.
    if (list && /^\s{2,}/.test(line)) {
      const last = list.items[list.items.length - 1]!;
      last.raw += "\n" + line.trim();
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}
