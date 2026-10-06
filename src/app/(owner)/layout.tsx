import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { requireOwner } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/dashboard" className="text-base font-semibold text-gray-900">E-Sign</Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Agreements</Link>
            <Link href="/templates" className="text-gray-600 hover:text-gray-900">Templates</Link>
          </nav>
          <form action={logoutAction}>
            <button className="btn btn-sm">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}
