"use client";

import { Logo } from "@/components/Icons";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-8" />
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Please try again. If it keeps happening, check the server logs
        {error.digest ? (
          <>
            {" "}for error <code className="font-mono text-xs">{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      <button type="button" className="btn btn-primary mt-6" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
