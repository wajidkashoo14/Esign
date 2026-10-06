// Control characters except \n and \t, plus bidi override characters that can
// be used to visually spoof text.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;

export function cleanText(input: string, maxLen: number): string {
  return input.normalize("NFC").replace(/\r\n?/g, "\n").replace(CONTROL, "").slice(0, maxLen);
}

/** Single-line field: no newlines, collapsed whitespace, trimmed. */
export function cleanLine(input: string, maxLen: number): string {
  return cleanText(input, maxLen * 2).replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncate(input: string, max: number): string {
  return input.length > max ? input.slice(0, max - 1) + "…" : input;
}
