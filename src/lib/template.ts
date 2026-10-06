const VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]{0,39})\s*\}\}/g;

/** Unique variable names used in the text, in order of first appearance. */
export function extractVariables(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) seen.add(m[1]!);
  return [...seen];
}

/** Names with no (or blank) value. */
export function missingVariables(text: string, values: Record<string, string>): string[] {
  return extractVariables(text).filter((n) => !(values[n] ?? "").trim());
}

/**
 * Single-pass substitution: substituted values are never re-scanned, so a value
 * containing "{{x}}" cannot trigger further expansion. Unknown names are left as-is.
 */
export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(VAR_RE, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? (values[name] as string) : whole,
  );
}
