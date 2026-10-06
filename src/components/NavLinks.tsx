"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Agreements", match: ["/dashboard", "/agreements"] },
  { href: "/templates", label: "Templates", match: ["/templates"] },
  { href: "/settings", label: "Settings", match: ["/settings"] },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto text-sm" aria-label="Main">
      {LINKS.map((l) => {
        const active = l.match.some((m) => path === m || path.startsWith(m + "/"));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-3 py-3 whitespace-nowrap transition ${
              active ? "border-blue-700 font-medium text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
