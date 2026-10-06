import { z } from "zod";
import { isValidTotpSecret } from "../totp";

const schema = z.object({
  OWNER_EMAIL: z.string().email(),
  OWNER_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$\d{2}\$.{53}$/, "must be a raw bcrypt hash ($2b$12$...), 60 characters"),
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  /** Optional base32 secret: when set, owner login also requires an authenticator code. */
  OWNER_TOTP_SECRET: z.string().refine(isValidTotpSecret, "must be a base32 secret from Settings > Two-step login").optional(),
  APP_URL: z
    .string()
    .url("must be a full URL such as https://your-app.vercel.app")
    .refine((u) => /^https?:\/\//.test(u), "must start with https://")
    .optional(),
  EMAIL_FROM: z.string().min(3).default("E-Sign <no-reply@localhost>"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  /** auto: signers must enter an emailed code whenever an email provider is configured. */
  SIGNER_EMAIL_OTP: z.enum(["auto", "on", "off"]).default("auto"),
  /** Optional PKCS#12 certificate (base64) used to digitally seal final PDFs. */
  PDF_SEAL_P12_BASE64: z.string().optional(),
  PDF_SEAL_P12_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

// Secrets that may legitimately contain leading/trailing spaces are not trimmed.
const UNTRIMMED = new Set(["SMTP_PASS", "PDF_SEAL_P12_PASSWORD"]);

let cached: Env | undefined;

/** Validated environment. Throws a readable error naming the bad variables (never their values). */
export function env(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(
    Object.keys(schema.shape).map((k) => {
      const v = process.env[k];
      const value = v === undefined ? undefined : UNTRIMMED.has(k) ? v : v.trim();
      return [k, value === "" ? undefined : value];
    }),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const bad = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration -> ${bad}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** Tests only: re-read process.env on the next call. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function emailProvider(): "resend" | "smtp" | "none" {
  const e = env();
  if (e.RESEND_API_KEY) return "resend";
  if (e.SMTP_HOST) return "smtp";
  return "none";
}

/** Whether signers must confirm a one-time code sent to their email before signing. */
export function signerOtpRequired(): boolean {
  const mode = env().SIGNER_EMAIL_OTP;
  if (mode === "off") return false;
  if (mode === "on") return true;
  return emailProvider() !== "none";
}

export const totpEnabled = () => !!env().OWNER_TOTP_SECRET;
export const sealConfigured = () => !!env().PDF_SEAL_P12_BASE64;
