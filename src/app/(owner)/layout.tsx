import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/Icons";
import { NavLinks } from "@/components/NavLinks";
import { requireOwner } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="py-3">
            <Logo />
          </Link>
          <div className="min-w-0 flex-1">
            <NavLinks />
          </div>
          <form action={logoutAction}>
            <button className="btn btn-ghost btn-sm text-gray-600">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </>
  );
}
