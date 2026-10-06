import { NextResponse } from "next/server";
import { isOwner } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { finalizeAgreement, safeFilename } from "@/lib/server/agreements";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const a = await db.agreement.findUnique({ where: { id }, select: { title: true, status: true, finalPdf: true } });
  if (!a || a.status !== "completed") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = a.finalPdf ?? (await finalizeAgreement(id));
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(a.title)}-signed.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
