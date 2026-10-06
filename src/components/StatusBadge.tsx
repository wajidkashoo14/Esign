import { STATUS_LABELS, type AgreementStatus } from "@/lib/state";

const STYLES: Record<AgreementStatus, { pill: string; dot: string }> = {
  draft: { pill: "bg-gray-100 text-gray-700 ring-gray-200", dot: "bg-gray-400" },
  sent: { pill: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  partially_signed: { pill: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  completed: { pill: "bg-green-50 text-green-700 ring-green-200", dot: "bg-green-500" },
  declined: { pill: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  voided: { pill: "bg-gray-100 text-gray-600 ring-gray-200", dot: "bg-gray-500" },
  expired: { pill: "bg-orange-50 text-orange-800 ring-orange-200", dot: "bg-orange-500" },
};

export function StatusBadge({ status }: { status: AgreementStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
