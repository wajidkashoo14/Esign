import { z } from "zod";
import { cleanLine, cleanText } from "./sanitize";
import { extractVariables } from "./template";

export const LIMITS = { title: 200, body: 50_000, name: 120, email: 254, signers: 20, varValue: 300, templateName: 100 } as const;

const line = (max: number) => z.string().transform((s) => cleanLine(s, max)).pipe(z.string().min(1, "Required"));

export const signerInput = z.object({
  name: line(LIMITS.name),
  email: z
    .string()
    .transform((s) => cleanLine(s, LIMITS.email).toLowerCase())
    .pipe(z.string().email("Invalid email address")),
});

/** "yyyy-mm-dd" (from <input type=date>) -> end of that day, UTC. */
export function parseExpiry(value: string | undefined | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid expiry date");
  const d = new Date(`${value}T23:59:59.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid expiry date");
  return d;
}

export const agreementInput = z
  .object({
    title: line(LIMITS.title),
    body: z.string().transform((s) => cleanText(s, LIMITS.body)).pipe(z.string().trim().min(1, "Body is required")),
    signingMode: z.enum(["parallel", "sequential"]),
    expiresAt: z
      .string()
      .optional()
      .transform((v, ctx) => {
        try {
          return parseExpiry(v);
        } catch {
          ctx.addIssue({ code: "custom", message: "Invalid expiry date" });
          return z.NEVER;
        }
      }),
    signers: z.array(signerInput).min(1, "Add at least one signer").max(LIMITS.signers),
    variables: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((v, ctx) => {
    const emails = v.signers.map((s) => s.email);
    if (new Set(emails).size !== emails.length) ctx.addIssue({ code: "custom", path: ["signers"], message: "Each signer needs a unique email" });
  })
  .transform((v) => {
    // Keep only values for variables that appear in the text, cleaned to single lines.
    const names = new Set([...extractVariables(v.body), ...extractVariables(v.title)]);
    const variables: Record<string, string> = {};
    for (const [k, val] of Object.entries(v.variables)) if (names.has(k)) variables[k] = cleanLine(val, LIMITS.varValue);
    return { ...v, variables };
  });

export type AgreementInput = z.output<typeof agreementInput>;

export const templateInput = z.object({
  name: line(LIMITS.templateName),
  title: line(LIMITS.title),
  body: z.string().transform((s) => cleanText(s, LIMITS.body)).pipe(z.string().trim().min(1, "Body is required")),
});

export const signatureInput = z
  .object({
    consent: z.literal("on", { error: "You must consent to sign electronically" }),
    method: z.enum(["typed", "drawn"]),
    typedName: z.string().transform((s) => cleanLine(s, 100)),
    image: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.method === "typed" && v.typedName.length < 2) ctx.addIssue({ code: "custom", path: ["typedName"], message: "Type your full name" });
  });

export function flattenErrors(err: z.ZodError): string {
  return err.issues.map((i) => i.message).filter((m, i, a) => a.indexOf(m) === i).join(". ");
}
