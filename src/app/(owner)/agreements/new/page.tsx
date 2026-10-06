import Link from "next/link";
import { AgreementForm } from "@/components/AgreementForm";
import { db } from "@/lib/server/db";

export const metadata = { title: "New agreement" };

export default async function NewAgreement({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template: templateId } = await searchParams;
  const [templates, chosen] = await Promise.all([
    db.template.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    templateId ? db.template.findUnique({ where: { id: templateId } }) : null,
  ]);
  const chip = (active: boolean) => `rounded-full px-3 py-1 ring-1 ring-gray-300 ${active ? "bg-gray-900 text-white" : "bg-white"}`;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">New agreement</h1>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600">Start from a template:</span>
        <Link href="/agreements/new" className={chip(!chosen)}>Blank</Link>
        {templates.map((t) => (
          <Link key={t.id} href={`/agreements/new?template=${t.id}`} className={chip(chosen?.id === t.id)}>
            {t.name}
          </Link>
        ))}
        {!templates.length && <Link href="/templates" className="text-blue-700 hover:underline">create a template</Link>}
      </div>
      <AgreementForm
        key={chosen?.id ?? "blank"}
        initial={{ title: chosen?.title ?? "", body: chosen?.body ?? "", signingMode: "parallel", expiresAt: "", signers: [], variables: {} }}
      />
    </div>
  );
}
