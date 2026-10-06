import { db } from "./db";

export interface LimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * Fixed-window counter stored in the database so it holds across serverless
 * instances. Increments on every call, whether or not the attempt was allowed.
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<LimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSec * 1000);

  // Reset an expired window, if any.
  await db.rateLimit.updateMany({ where: { key, resetAt: { lte: now } }, data: { count: 0, resetAt } });
  await db.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, resetAt },
    update: { count: { increment: 1 } },
  });
  const row = await db.rateLimit.findUnique({ where: { key } });
  const count = row?.count ?? 1;
  const retryAfterSec = Math.max(1, Math.ceil(((row?.resetAt ?? resetAt).getTime() - now.getTime()) / 1000));
  return { allowed: count <= limit, retryAfterSec };
}

export async function clear(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}
