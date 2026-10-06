import { headers } from "next/headers";
import { truncate } from "../sanitize";
import { env } from "./env";

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

const IP_RE = /^[0-9a-fA-F:.]{3,45}$/;

/**
 * Client IP + UA for audit records. x-forwarded-for is set by the platform
 * proxy (Vercel); when self-hosting, make sure your reverse proxy overwrites it.
 */
export async function clientInfo(): Promise<ClientInfo> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const raw = fwd || h.get("x-real-ip")?.trim() || null;
  const ua = h.get("user-agent");
  return { ip: raw && IP_RE.test(raw) ? raw : null, userAgent: ua ? truncate(ua.replace(/[^\x20-\x7E]/g, "?"), 300) : null };
}

/** Public base URL used in emailed links. */
export async function baseUrl(): Promise<string> {
  const configured = env().APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
