import { redirect } from "next/navigation";
import { Logo } from "@/components/Icons";
import { LoginForm } from "@/components/LoginForm";
import { isOwner } from "@/lib/server/auth";
import { totpEnabled } from "@/lib/server/env";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isOwner()) redirect("/dashboard");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-6 text-lg" />
      <div className="w-full max-w-sm">
        <LoginForm twoStep={totpEnabled()} />
      </div>
    </main>
  );
}
