"use client";

import { useRef, useState } from "react";
import { createTemplateAction } from "@/app/actions/templates";
import { useServerForm } from "./useServerForm";

const SAMPLE = {
  name: "Mutual NDA",
  title: "Mutual Non-Disclosure Agreement",
  body: `This agreement is made on **{{date}}** between **{{party_a}}** and **{{party_b}}** (each a "Party").

## 1. Purpose

The Parties wish to share confidential information to evaluate {{purpose}}.

## 2. Obligations

1. Each Party will keep the other's confidential information secret and use it only for the purpose above.
2. Each Party will limit access to people who need to know it and are bound by similar duties.
3. On request, each Party will return or destroy the other's confidential information.

## 3. Term

This agreement lasts for **{{years}} years** from the date above.

---

Signed electronically by the Parties below.`,
};

export function TemplateForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState({ name: "", title: "", body: "" });
  const { state, pending, onSubmit } = useServerForm(async (prev, fd) => {
    const res = await createTemplateAction(prev, fd);
    if (res.ok) setFields({ name: "", title: "", body: "" });
    return res;
  });
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form ref={ref} onSubmit={onSubmit} className="card h-fit space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="card-title">New template</h2>
        <button type="button" className="text-sm text-blue-700 hover:underline" onClick={() => setFields(SAMPLE)}>
          Fill with a sample NDA
        </button>
      </div>
      <div>
        <label className="label" htmlFor="t-name">Template name</label>
        <input id="t-name" name="name" required maxLength={100} className="input" value={fields.name} onChange={set("name")} />
      </div>
      <div>
        <label className="label" htmlFor="t-title">Agreement title</label>
        <input id="t-title" name="title" required maxLength={200} className="input" value={fields.title} onChange={set("title")} />
      </div>
      <div>
        <label className="label" htmlFor="t-body">Text</label>
        <textarea
          id="t-body"
          name="body"
          required
          maxLength={50000}
          className="input min-h-64 font-mono !text-sm"
          value={fields.body}
          onChange={set("body")}
          placeholder={"# Title\n\nThis agreement is made on {{date}} between **{{company}}** and **{{client}}**."}
        />
        <p className="hint">Supports # headings, **bold**, numbered and bullet lists, and --- lines.</p>
      </div>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state.ok && <p className="alert-ok">{state.message}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving..." : "Save template"}</button>
    </form>
  );
}
