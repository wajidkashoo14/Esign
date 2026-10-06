import { z } from "zod";

const schema = z.object({
  OWNER_EMAIL: z.string().email(),
  OWNER_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$\d{2}\$.{53}$/, "must be a bcrypt hash"),
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  APP_URL: z.string().url().optional(),
  EMAIL_FROM: z.string().min(3).default("E-Sign <no-reply@localhost>"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated environment. Throws a readable error naming the bad variables (never their values). */
export function env(): Env {
  if (cached) return cached;
  const blank = (v: string | undefined) => (v && v.trim() !== "" ? v : undefined);
  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, blank(process.env[k])]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const bad = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration -> ${bad}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function emailProvider(): "resend" | "smtp" | "none" {
  const e = env();
  if (e.RESEND_API_KEY) return "resend";
  if (e.SMTP_HOST) return "smtp";
  return "none";
}
