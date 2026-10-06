// Small inline icons (stroke-based, 24x24 viewBox) so no icon library is needed.
type P = { className?: string };
const base = (className?: string) => ({
  className: className ?? "h-4 w-4",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconPen = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const IconX = ({ className }: P) => (
  <svg {...base(className)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const IconClock = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconEye = ({ className }: P) => (
  <svg {...base(className)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconMail = ({ className }: P) => (
  <svg {...base(className)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
);
export const IconShield = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconDownload = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
);
export const IconSend = ({ className }: P) => (
  <svg {...base(className)}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" /></svg>
);
export const IconPlus = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconDoc = ({ className }: P) => (
  <svg {...base(className)}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>
);
export const IconLock = ({ className }: P) => (
  <svg {...base(className)}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const IconSearch = ({ className }: P) => (
  <svg {...base(className)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconBan = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>
);
export const IconRefresh = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" /></svg>
);

export function Logo({ className }: P) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold text-gray-900 ${className ?? ""}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-700 text-white">
        <IconPen className="h-4 w-4" />
      </span>
      E-Sign
    </span>
  );
}
