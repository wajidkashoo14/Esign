/**
 * Minimal structured logger. Callers pass only event codes and opaque ids
 * (agreement/signer ids). Never pass names, emails, IPs, tokens or document text.
 */
type Fields = Record<string, string | number | boolean | null | undefined>;

export const log = {
  info: (event: string, fields: Fields = {}) => console.log(JSON.stringify({ level: "info", event, ...fields })),
  warn: (event: string, fields: Fields = {}) => console.warn(JSON.stringify({ level: "warn", event, ...fields })),
  /** Logs the error class/code only, not the message (messages can embed user data). */
  error: (event: string, err: unknown, fields: Fields = {}) =>
    console.error(
      JSON.stringify({
        level: "error",
        event,
        error: err instanceof Error ? err.name : "unknown",
        code: (err as { code?: string } | null)?.code,
        ...fields,
      }),
    ),
};
