"use client";

import { loginAction } from "@/app/actions/auth";
import { useServerForm } from "./useServerForm";

export function LoginForm({ twoStep }: { twoStep: boolean }) {
  const { state, pending, onSubmit } = useServerForm(loginAction);
  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-gray-500">Owner access to your agreements.</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {twoStep && (
        <div>
          <label className="label" htmlFor="code">Authenticator code</label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className="input font-mono tracking-widest"
          />
        </div>
      )}
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      <button className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
