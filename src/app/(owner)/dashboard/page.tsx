import Link from "next/link";
import { db } from "@/lib/server/db";
import { expireOverdue } from "@/lib/server/agreements";
import { AGREEMENT_STATUSES, STATUS_LABELS, isStatus } from "@/lib/state";
import { fmtDate } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Agreements" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = status && isStatus(status) ? status : undefined;
  await expireOverdue();
  const [rows, counts] = await Promise.all([
    db.agreement.findMany({
      where: filter ? { status: filter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, status: true, createdAt: true, expiresAt: true, signers: { select: { signedAt: true } } },
    }),
    db.agreement.groupBy({ by: ["status"], _count: true }),
  ]);
  const total = counts.reduce((n, c) => n + c._count, 0);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  const tab = (href: string, label: string, n: number, active: boolean) => (
    <Link
      key={label}
      href={href}
      className={`rounded-full px-3 py-1 text-sm ${active ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"}`}
    >
      {label} <span className="opacity-60">{n}</span>
    </Link>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agreements</h1>
        <Link href="/agreements/new" className="btn btn-primary">New agreement</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {tab("/dashboard", "All", total, !filter)}
        {AGREEMENT_STATUSES.map((s) => tab(`/dashboard?status=${s}`, STATUS_LABELS[s], countOf(s), filter === s))}
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Signed</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/agreements/${r.id}`} className="text-blue-700 hover:underline">{r.title}</Link>
                </td>
                <td className="px-4 py-3"><StatusBadge status={isStatus(r.status) ? r.status : "draft"} /></td>
                <td className="px-4 py-3 text-gray-600">{r.signers.filter((s) => s.signedAt).length}/{r.signers.length}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(r.expiresAt)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No agreements here yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
