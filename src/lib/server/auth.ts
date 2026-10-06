import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual } from "../tokens";
import { env } from "./env";

export const SESSION_COOKIE = "esign_session";
export const SESSION_TTL_SEC = 60 * 60 * 8;

// Real hash of a throwaway value; compared against when the email is wrong so that
// wrong-email and wrong-password cost the same time.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-the-password", 12));

export async function checkCredentials(email: string, password: string): Promise<boolean> {
  const e = env();
  const emailOk = safeEqual(email.trim().toLowerCase(), e.OWNER_EMAIL.toLowerCase());
  const pwOk = await bcrypt.compare(password.slice(0, 200), emailOk ? e.OWNER_PASSWORD_HASH : getDummyHash()).catch(() => false);
  return emailOk && pwOk;
}

const secretKey = () => new TextEncoder().encode(env().AUTH_SECRET);

export async function startSession(): Promise<void> {
  const token = await new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("owner")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(secretKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.sub === "owner" && payload.role === "owner";
  } catch {
    return false;
  }
}

export async function isOwner(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Call at the top of every owner page, server action and API route (middleware is only a first line of defence). */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) redirect("/login");
}
