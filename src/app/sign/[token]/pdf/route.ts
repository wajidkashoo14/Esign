import { NextResponse } from "next/server";
import { getSignerPdf } from "@/lib/server/agreements";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Signed PDF for a signer of a completed agreement, authorised by their personal link. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const res = await getSignerPdf(token);
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(Buffer.from(res.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${res.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
