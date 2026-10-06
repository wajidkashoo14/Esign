"use client";

import { useMemo, useState } from "react";
import { saveAgreementAction } from "@/app/actions/agreements";
import { extractVariables } from "@/lib/template";
import { useServerForm } from "./useServerForm";

export interface AgreementFormInitial {
  id?: string;
  title: string;
  body: string;
  signingMode: "parallel" | "sequential";
  expiresAt: string; // yyyy-mm-dd or ""
  signers: { name: string; email: string }[];
  variables: Record<string, string>;
}

export function AgreementForm({ initial }: { initial: AgreementFormInitial }) {
  const { state, pending, onSubmit } = useServerForm(saveAgreementAction);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [mode, setMode] = useState(initial.signingMode);
  const [expiresAt, setExpiresAt] = useState(initial.expiresAt);
  const [signers, setSigners] = useState(initial.signers.length ? initial.signers : [{ name: "", email: "" }]);
  const [vars, setVars] = useState(initial.variables);

  const names = useMemo(() => extractVariables(`${title}\n${body}`), [title, body]);

  const setSigner = (i: number, patch: Partial<{ name: string; email: string }>) =>
    setSigners((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setSigners((s) => {
      const j = i + d;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="signers" value={JSON.stringify(signers)} />

      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" className="input" maxLength={200} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="body">Agreement text</label>
          <textarea
            id="body"
            name="body"
            className="input min-h-72 font-mono"
            maxLength={50000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            Plain text. Use <code>{"{{variable_name}}"}</code> for values filled in before sending. The text is locked once sent.
          </p>
        </div>
        {names.length > 0 && (
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Variable values</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {names.map((n) => (
                <div key={n}>
                  <label className="label" htmlFor={`var-${n}`}>{n}</label>
                  <input
                    id={`var-${n}`}
                    name={`var:${n}`}
                    className="input"
                    maxLength={300}
                    value={vars[n] ?? ""}
                    onChange={(e) => setVars((v) => ({ ...v, [n]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <fieldset>
            <legend className="label">Signing order</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="signingMode" value="parallel" checked={mode === "parallel"} onChange={() => setMode("parallel")} />
                Parallel (everyone at once)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="signingMode" value="sequential" checked={mode === "sequential"} onChange={() => setMode("sequential")} />
                Sequential (in the order below)
              </label>
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="expiresAt">Expires (optional)</label>
            <input id="expiresAt" name="expiresAt" type="date" className="input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="label">Signers</p>
          {signers.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-5 text-sm text-gray-500">{i + 1}.</span>
              <input aria-label={`Signer ${i + 1} name`} placeholder="Full name" className="input min-w-40 flex-1" maxLength={120} value={s.name} onChange={(e) => setSigner(i, { name: e.target.value })} />
              <input aria-label={`Signer ${i + 1} email`} type="email" placeholder="email@example.com" className="input min-w-52 flex-1" maxLength={254} value={s.email} onChange={(e) => setSigner(i, { email: e.target.value })} />
              <button type="button" className="btn btn-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="btn btn-sm" aria-label="Move down" disabled={i === signers.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="btn btn-sm btn-danger" disabled={signers.length === 1} onClick={() => setSigners((x) => x.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" disabled={signers.length >= 20} onClick={() => setSigners((s) => [...s, { name: "", email: "" }])}>
            + Add signer
          </button>
        </div>
      </div>

      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : initial.id ? "Save draft" : "Create draft"}</button>
    </form>
  );
}
