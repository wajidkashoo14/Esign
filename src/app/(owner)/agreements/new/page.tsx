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
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition ${active ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"}`;
  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← All agreements</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New agreement</h1>
      </div>
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 text-sm md:mx-0 md:flex-wrap md:px-0">
        <span className="whitespace-nowrap text-gray-500">Start from:</span>
        <Link href="/agreements/new" className={chip(!chosen)}>Blank</Link>
        {templates.map((t) => (
          <Link key={t.id} href={`/agreements/new?template=${t.id}`} className={chip(chosen?.id === t.id)}>
            {t.name}
          </Link>
        ))}
        {!templates.length && (
          <Link href="/templates" className="whitespace-nowrap text-blue-700 hover:underline">
            + Create a template
          </Link>
        )}
      </div>
      <AgreementForm
        key={chosen?.id ?? "blank"}
        initial={{ title: chosen?.title ?? "", body: chosen?.body ?? "", signingMode: "parallel", expiresAt: "", signers: [], variables: {} }}
      />
    </div>
  );
}
