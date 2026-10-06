import Link from "next/link";
import { Logo } from "@/components/Icons";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-8" />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-gray-500">The page you’re looking for doesn’t exist or has moved.</p>
      <Link href="/" className="btn mt-6">Go home</Link>
    </main>
  );
}
