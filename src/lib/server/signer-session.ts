import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { OTP_SESSION_SEC } from "../otp";
import { env } from "./env";

// After a signer enters a correct email code, this browser gets a short-lived signed
// cookie bound to their current link's token hash (a new link invalidates it).

const cookieName = (tokenHash: string) => `esign_v_${tokenHash.slice(0, 16)}`;
const key = () => new TextEncoder().encode(env().AUTH_SECRET);

export async function markSignerVerified(tokenHash: string): Promise<void> {
  const jwt = await new SignJWT({ typ: "signer-otp" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(tokenHash)
    .setIssuedAt()
    .setExpirationTime(`${OTP_SESSION_SEC}s`)
    .sign(key());
  (await cookies()).set(cookieName(tokenHash), jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/sign",
    maxAge: OTP_SESSION_SEC,
  });
}

export async function isSignerVerified(tokenHash: string): Promise<boolean> {
  const jwt = (await cookies()).get(cookieName(tokenHash))?.value;
  if (!jwt) return false;
  try {
    const { payload } = await jwtVerify(jwt, key(), { algorithms: ["HS256"] });
    return payload.typ === "signer-otp" && payload.sub === tokenHash;
  } catch {
    return false;
  }
}
