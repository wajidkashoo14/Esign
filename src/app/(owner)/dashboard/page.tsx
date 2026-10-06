import Link from "next/link";
import { IconDoc, IconPlus, IconSearch } from "@/components/Icons";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/format";
import { expireOverdue } from "@/lib/server/agreements";
import { db } from "@/lib/server/db";
import { AGREEMENT_STATUSES, STATUS_LABELS, isStatus, type AgreementStatus } from "@/lib/state";

export const metadata = { title: "Agreements" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q: rawQ } = await searchParams;
  const filter = status && isStatus(status) ? status : undefined;
  const q = (rawQ ?? "").trim().toLowerCase().slice(0, 100);
  await expireOverdue();

  const [all, counts] = await Promise.all([
    db.agreement.findMany({
      where: filter ? { status: filter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        signers: { select: { name: true, email: true, signedAt: true, declinedAt: true }, orderBy: { order: "asc" } },
      },
    }),
    db.agreement.groupBy({ by: ["status"], _count: true }),
  ]);
  // Filter in memory: consistent case-insensitive matching on both SQLite and Postgres.
  const rows = q
    ? all.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.signers.some((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)),
      )
    : all;

  const countOf = (...s: AgreementStatus[]) => counts.filter((c) => s.includes(c.status as AgreementStatus)).reduce((n, c) => n + c._count, 0);
  const total = counts.reduce((n, c) => n + c._count, 0);
  const qs = (s?: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    const str = p.toString();
    return str ? `/dashboard?${str}` : "/dashboard";
  };

  const stats = [
    { label: "Awaiting signature", value: countOf("sent", "partially_signed"), href: qs("sent") },
    { label: "Completed", value: countOf("completed"), href: qs("completed") },
    { label: "Drafts", value: countOf("draft"), href: qs("draft") },
    { label: "Declined or expired", value: countOf("declined", "expired"), href: qs("declined") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agreements</h1>
          <p className="text-sm text-gray-500">Create, send and track documents for signature.</p>
        </div>
        <Link href="/agreements/new" className="btn btn-primary">
          <IconPlus /> New agreement
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card !p-4 transition hover:border-blue-300">
            <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-gray-500 sm:text-sm">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {[{ s: undefined, label: "All", n: total }, ...AGREEMENT_STATUSES.map((s) => ({ s, label: STATUS_LABELS[s], n: countOf(s) }))].map((t) => (
            <Link
              key={t.label}
              href={qs(t.s)}
              className={`rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition ${
                filter === t.s ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.label} <span className="opacity-60">{t.n}</span>
            </Link>
          ))}
        </div>
        <form action="/dashboard" className="relative md:w-72">
          {filter && <input type="hidden" name="status" value={filter} />}
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input name="q" defaultValue={rawQ ?? ""} placeholder="Search title, name or email" className="input !pl-9" aria-label="Search agreements" />
        </form>
      </div>

      {rows.length ? (
        <ul className="card divide-y divide-gray-100 !p-0">
          {rows.map((r) => {
            const st = isStatus(r.status) ? r.status : "draft";
            const signed = r.signers.filter((s) => s.signedAt).length;
            const pct = r.signers.length ? Math.round((signed / r.signers.length) * 100) : 0;
            return (
              <li key={r.id}>
                <Link href={`/agreements/${r.id}`} className="grid gap-2 px-4 py-4 transition hover:bg-gray-50 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900">{r.title}</p>
                    </div>
                    <p className="truncate text-sm text-gray-500">{r.signers.map((s) => s.name).join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-4 sm:justify-end">
                    <div className="flex w-28 items-center gap-2" title={`${signed} of ${r.signers.length} signed`}>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums">
                        {signed}/{r.signers.length}
                      </span>
                    </div>
                    <StatusBadge status={st} />
                    <span className="hidden w-24 text-right text-xs text-gray-500 md:block">
                      {st === "draft" ? `Created ${fmtDate(r.createdAt)}` : r.expiresAt && (st === "sent" || st === "partially_signed") ? `Due ${fmtDate(r.expiresAt)}` : fmtDate(r.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card flex flex-col items-center py-14 text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-700">
            <IconDoc className="h-6 w-6" />
          </span>
          <p className="font-medium">{q || filter ? "Nothing matches" : "No agreements yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {q || filter ? "Try another filter or search." : "Create your first agreement, add signers and send it for signature."}
          </p>
          {!q && !filter && (
            <Link href="/agreements/new" className="btn btn-primary mt-5">
              <IconPlus /> New agreement
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
