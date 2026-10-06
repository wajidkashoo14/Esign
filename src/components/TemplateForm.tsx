"use client";

import { useRef } from "react";
import { createTemplateAction } from "@/app/actions/templates";
import { useServerForm } from "./useServerForm";

export function TemplateForm() {
  const ref = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useServerForm(async (prev, fd) => {
    const res = await createTemplateAction(prev, fd);
    if (res.ok) ref.current?.reset();
    return res;
  });
  return (
    <form ref={ref} onSubmit={onSubmit} className="card space-y-4">
      <h2 className="font-semibold">New template</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-name">Template name</label>
          <input id="t-name" name="name" required maxLength={100} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="t-title">Default agreement title</label>
          <input id="t-title" name="title" required maxLength={200} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="t-body">Text</label>
        <textarea id="t-body" name="body" required maxLength={50000} className="input min-h-48 font-mono" placeholder={"This agreement is made on {{date}} between {{company}} and {{client}}..."} />
        <p className="mt-1 text-xs text-gray-500">Use {"{{variable}}"} placeholders; values are filled in per agreement.</p>
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{state.message}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : "Save template"}</button>
    </form>
  );
}
