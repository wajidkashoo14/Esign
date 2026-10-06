import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isOwner } from "@/lib/server/auth";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isOwner()) redirect("/dashboard");
  return (
    <main className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="mb-6 text-center text-2xl font-semibold">E-Sign</h1>
      <LoginForm />
    </main>
  );
}
