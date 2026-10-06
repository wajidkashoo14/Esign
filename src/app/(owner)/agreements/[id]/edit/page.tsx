import { notFound, redirect } from "next/navigation";
import { AgreementForm } from "@/components/AgreementForm";
import { db } from "@/lib/server/db";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Edit draft" };

export default async function EditAgreement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.agreement.findUnique({ where: { id }, include: { signers: { orderBy: { order: "asc" } } } });
  if (!a) notFound();
  if (a.status !== "draft") redirect(`/agreements/${id}`);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Edit draft</h1>
      <AgreementForm
        initial={{
          id: a.id,
          title: a.title,
          body: a.body,
          signingMode: a.signingMode === "sequential" ? "sequential" : "parallel",
          expiresAt: a.expiresAt ? fmtDate(a.expiresAt) : "",
          signers: a.signers.map((s) => ({ name: s.name, email: s.email })),
          variables: JSON.parse(a.variables) as Record<string, string>,
        }}
      />
    </div>
  );
}
