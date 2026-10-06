"use client";

import { useMemo, useRef, useState } from "react";
import { saveAgreementAction } from "@/app/actions/agreements";
import { extractVariables, renderTemplate } from "@/lib/template";
import { AgreementBody } from "./AgreementBody";
import { IconPlus, IconX } from "./Icons";
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

const today = () => new Date().toISOString().slice(0, 10);

export function AgreementForm({ initial }: { initial: AgreementFormInitial }) {
  const { state, pending, onSubmit } = useServerForm(saveAgreementAction);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [mode, setMode] = useState(initial.signingMode);
  const [expiresAt, setExpiresAt] = useState(initial.expiresAt);
  const [signers, setSigners] = useState(initial.signers.length ? initial.signers : [{ name: "", email: "" }]);
  const [vars, setVars] = useState(initial.variables);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const names = useMemo(() => extractVariables(`${title}\n${body}`), [title, body]);
  const previewVars = useMemo(
    () => Object.fromEntries(names.filter((n) => vars[n]?.trim()).map((n) => [n, vars[n]!])),
    [names, vars],
  );

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

  /** Formatting toolbar: wrap the selection or prefix the current lines. */
  const format = (kind: "bold" | "h2" | "list" | "numbered" | "hr" | "variable") => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const sel = value.slice(a, b);
    let insert: string;
    let start = a;
    const end = b;
    if (kind === "bold") insert = `**${sel || "bold text"}**`;
    else if (kind === "variable") insert = `{{${sel.replace(/\W+/g, "_") || "variable_name"}}}`;
    else if (kind === "hr") insert = `\n---\n`;
    else {
      start = value.lastIndexOf("\n", a - 1) + 1;
      const lines = value.slice(start, b).split("\n");
      const prefix = (n: number) => (kind === "h2" ? "## " : kind === "list" ? "- " : `${n + 1}. `);
      insert = lines.map((l, n) => prefix(n) + l.replace(/^(#{1,3}\s+|-\s+|\d+\.\s+)/, "")).join("\n");
    }
    const next = value.slice(0, start) + insert + value.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="signers" value={JSON.stringify(signers)} />
      <input type="hidden" name="body" value={body} />

      <div className="min-w-0 space-y-6">
        <div className="card space-y-5">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input
              id="title"
              name="title"
              className="input text-base font-medium"
              maxLength={200}
              required
              placeholder="e.g. Consulting Agreement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="label !mb-0">Agreement text</span>
              <div className="flex rounded-lg bg-gray-100 p-0.5 text-sm" role="tablist">
                {(["write", "preview"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3 py-1 capitalize transition ${tab === t ? "bg-white font-medium shadow-sm" : "text-gray-600"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {tab === "write" ? (
              <div className="overflow-hidden rounded-lg border border-gray-300 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
                <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
                  {[
                    { k: "bold", label: "B", title: "Bold", cls: "font-bold" },
                    { k: "h2", label: "H", title: "Heading", cls: "font-semibold" },
                    { k: "numbered", label: "1.", title: "Numbered list", cls: "" },
                    { k: "list", label: "•", title: "Bullet list", cls: "" },
                    { k: "hr", label: "—", title: "Divider line", cls: "" },
                    { k: "variable", label: "{{ }}", title: "Variable", cls: "font-mono text-xs" },
                  ].map((b) => (
                    <button
                      key={b.k}
                      type="button"
                      title={b.title}
                      aria-label={b.title}
                      onClick={() => format(b.k as Parameters<typeof format>[0])}
                      className={`min-w-8 rounded px-2 py-1 text-sm text-gray-700 hover:bg-white hover:shadow-sm ${b.cls}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                <textarea
                  id="body"
                  ref={bodyRef}
                  aria-label="Agreement text"
                  className="block min-h-[420px] w-full resize-y border-0 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-gray-900 outline-none"
                  maxLength={50000}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={"# Services Agreement\n\nThis agreement is made on {{date}} between **{{company}}** and **{{client}}**.\n\n## 1. Services\n\n1. The provider will ...\n2. The client will ..."}
                />
              </div>
            ) : (
              <div className="min-h-[420px] rounded-lg border border-gray-200 bg-white px-5 py-4">
                {body.trim() ? (
                  <>
                    <h2 className="mb-4 text-xl font-semibold">{renderTemplate(title, previewVars) || "Untitled"}</h2>
                    <AgreementBody text={renderTemplate(body, previewVars)} />
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Nothing to preview yet.</p>
                )}
              </div>
            )}
            <p className="hint">
              <span className="kbd"># Heading</span> <span className="kbd">**bold**</span> <span className="kbd">1. item</span>{" "}
              <span className="kbd">- item</span> <span className="kbd">---</span> and <span className="kbd">{"{{variable}}"}</span> for values
              filled in before sending. The text is locked once sent.
            </p>
          </div>

          {names.length > 0 && (
            <div className="rounded-xl bg-blue-50/60 p-4 ring-1 ring-blue-100">
              <p className="mb-3 text-sm font-medium text-gray-800">Fill in the variables</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {names.map((n) => (
                  <div key={n}>
                    <label className="label font-mono !text-xs" htmlFor={`var-${n}`}>{n}</label>
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
      </div>

      <div className="space-y-6">
        <div className="card space-y-4">
          <h2 className="card-title">Signers</h2>
          <ol className="space-y-3">
            {signers.map((s, i) => (
              <li key={i} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">{mode === "sequential" ? `Signs ${ordinal(i + 1)}` : `Signer ${i + 1}`}</span>
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Move down" disabled={i === signers.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button type="button" className="btn btn-ghost btn-sm !px-2 text-gray-500" aria-label="Remove signer" disabled={signers.length === 1} onClick={() => setSigners((x) => x.filter((_, j) => j !== i))}>
                      <IconX />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <input aria-label={`Signer ${i + 1} name`} placeholder="Full name" className="input" maxLength={120} value={s.name} onChange={(e) => setSigner(i, { name: e.target.value })} />
                  <input aria-label={`Signer ${i + 1} email`} type="email" inputMode="email" placeholder="email@example.com" className="input" maxLength={254} value={s.email} onChange={(e) => setSigner(i, { email: e.target.value })} />
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-sm w-full" disabled={signers.length >= 20} onClick={() => setSigners((s) => [...s, { name: "", email: "" }])}>
            <IconPlus /> Add signer
          </button>
        </div>

        <div className="card space-y-4">
          <h2 className="card-title">Options</h2>
          <fieldset className="space-y-2">
            <legend className="label">Signing order</legend>
            {(
              [
                ["parallel", "Everyone at once", "All signers get their link immediately."],
                ["sequential", "One after another", "Each signer gets a link after the previous one signs."],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${mode === value ? "border-blue-600 bg-blue-50/50" : "border-gray-200"}`}>
                <input type="radio" name="signingMode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-gray-500">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <label className="label" htmlFor="expiresAt">Expiry date (optional)</label>
            <input id="expiresAt" name="expiresAt" type="date" min={today()} className="input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <p className="hint">Signing closes at the end of this day (UTC).</p>
          </div>
        </div>

        {state.error && <p role="alert" className="alert-error">{state.error}</p>}
        <button className="btn btn-primary btn-lg w-full" disabled={pending}>
          {pending ? "Saving..." : initial.id ? "Save draft" : "Create draft"}
        </button>
        <p className="text-center text-xs text-gray-500">You can review everything before sending.</p>
      </div>
    </form>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
