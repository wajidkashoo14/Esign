import { STATUS_LABELS, type AgreementStatus } from "@/lib/state";

const STYLES: Record<AgreementStatus, string> = {
  draft: "bg-gray-100 text-gray-700 ring-gray-300",
  sent: "bg-blue-50 text-blue-700 ring-blue-200",
  partially_signed: "bg-amber-50 text-amber-800 ring-amber-200",
  completed: "bg-green-50 text-green-700 ring-green-200",
  voided: "bg-red-50 text-red-700 ring-red-200",
  expired: "bg-orange-50 text-orange-800 ring-orange-200",
};

export function StatusBadge({ status }: { status: AgreementStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
