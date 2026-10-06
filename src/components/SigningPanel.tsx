"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { declineAction, requestOtpAction, submitSignatureAction, verifyOtpAction } from "@/app/actions/signing";
import type { ActionState } from "@/app/actions/types";
import { ConfirmButton } from "./ConfirmButton";
import { IconMail, IconPen, IconShield } from "./Icons";
import { useServerForm } from "./useServerForm";

const W = 600;
const H = 200;
const INK = "#0b1b4d";

export function SigningPanel({
  token,
  defaultName,
  maskedEmail,
  needsCode,
}: {
  token: string;
  defaultName: string;
  maskedEmail: string;
  needsCode: boolean;
}) {
  return (
    <div className="space-y-4">
      {needsCode ? <CodeGate token={token} maskedEmail={maskedEmail} /> : <SignForm token={token} defaultName={defaultName} />}
      <DeclineBox token={token} />
    </div>
  );
}

// ------------------------------------------------------------------ email code

function CodeGate({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const router = useRouter();
  const send = useServerForm(requestOtpAction);
  const verify = useServerForm(verifyOtpAction);
  const [code, setCode] = useState("");
  const sent = !!send.state.ok;

  useEffect(() => {
    if (verify.state.ok) router.refresh();
  }, [verify.state.ok, router]);

  return (
    <section className="card space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-indigo-50 text-indigo-700">
          <IconShield className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Confirm it’s you</h2>
          <p className="text-sm text-gray-600">
            We’ll email a 6-digit code to <strong className="font-medium text-gray-900">{maskedEmail}</strong>, the address this request was
            sent to.
          </p>
        </div>
      </div>

      {!sent ? (
        <form onSubmit={send.onSubmit}>
          <input type="hidden" name="token" value={token} />
          <button className="btn btn-primary btn-lg w-full sm:w-auto" disabled={send.pending}>
            <IconMail /> {send.pending ? "Sending..." : "Email me a code"}
          </button>
          {send.state.error && <p role="alert" className="alert-error mt-3">{send.state.error}</p>}
        </form>
      ) : (
        <form onSubmit={verify.onSubmit} className="space-y-3">
          <p className="alert-info">{send.state.message}</p>
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="label" htmlFor="otp-code">6-digit code</label>
            <input
              id="otp-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="input max-w-48 text-center font-mono text-2xl tracking-[0.4em]"
            />
          </div>
          {verify.state.error && <p role="alert" className="alert-error">{verify.state.error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary btn-lg" disabled={verify.pending || code.length !== 6}>
              {verify.pending ? "Checking..." : "Continue"}
            </button>
            <button
              type="button"
              className="text-sm text-blue-700 hover:underline disabled:opacity-50"
              disabled={send.pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("token", token);
                send.run(fd);
              }}
            >
              Send a new code
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ signature

function SignForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<"typed" | "drawn">("typed");
  const [typedName, setTypedName] = useState(defaultName);
  const [consent, setConsent] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  // Crisp drawing on high-density screens: back the canvas with more pixels.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || method !== "drawn") return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = INK;
    g.lineWidth = 2.6;
    g.lineCap = "round";
    g.lineJoin = "round";
    setHasInk(false);
  }, [method]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    last.current = p;
    const g = e.currentTarget.getContext("2d")!;
    g.beginPath();
    g.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
    setHasInk(true);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const g = e.currentTarget.getContext("2d")!;
    const p = point(e);
    const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
    g.beginPath();
    g.moveTo(last.current.x, last.current.y);
    g.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    last.current = p;
  };
  const onUp = () => {
    last.current = null;
  };
  const clearPad = () => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.restore();
    setHasInk(false);
  };

  /** Render the typed name to a PNG with the cursive font, on a transparent canvas. */
  async function typedPng(): Promise<string> {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-script").trim() || "cursive";
    try {
      await document.fonts.load(`64px ${family}`, typedName);
    } catch {
      /* fall back to the generic cursive family */
    }
    const c = document.createElement("canvas");
    c.width = W * 2;
    c.height = H * 2;
    const g = c.getContext("2d")!;
    g.scale(2, 2);
    g.fillStyle = INK;
    g.textBaseline = "middle";
    let size = 72;
    g.font = `${size}px ${family}, cursive`;
    while (g.measureText(typedName).width > W - 40 && size > 20) {
      size -= 4;
      g.font = `${size}px ${family}, cursive`;
    }
    g.fillText(typedName, 20, H / 2);
    return c.toDataURL("image/png");
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (method === "drawn" && !hasInk) return setState({ error: "Please draw your signature in the box." });
    if (method === "typed" && typedName.trim().length < 2) return setState({ error: "Please type your full name." });
    if (!consent) return setState({ error: "Please tick the box to agree to sign electronically." });
    setState({});
    start(async () => {
      const image = method === "typed" ? await typedPng() : canvasRef.current!.toDataURL("image/png");
      const fd = new FormData();
      fd.set("token", token);
      fd.set("consent", "on");
      fd.set("method", method);
      fd.set("typedName", typedName);
      fd.set("image", image);
      setState(await submitSignatureAction({}, fd));
    });
  };

  const tab = (active: boolean) =>
    `flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`;

  return (
    <form onSubmit={submit} className="card space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-blue-50 text-blue-700">
          <IconPen className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Add your signature</h2>
          <p className="text-sm text-gray-600">Type your name or draw your signature.</p>
        </div>
      </div>

      <div className="flex rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Signature method">
        <button type="button" role="tab" aria-selected={method === "typed"} className={tab(method === "typed")} onClick={() => setMethod("typed")}>
          Type
        </button>
        <button type="button" role="tab" aria-selected={method === "drawn"} className={tab(method === "drawn")} onClick={() => setMethod("drawn")}>
          Draw
        </button>
      </div>

      {method === "typed" ? (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="typedName">Your full name</label>
            <input id="typedName" className="input text-base" autoComplete="name" maxLength={100} value={typedName} onChange={(e) => setTypedName(e.target.value)} />
          </div>
          <div className="relative flex h-32 items-center overflow-hidden rounded-xl border border-gray-200 bg-white px-6" aria-label="Signature preview">
            <span className="truncate text-5xl sm:text-6xl" style={{ fontFamily: "var(--font-script), cursive", color: INK }}>
              {typedName || " "}
            </span>
            <span className="absolute right-6 bottom-6 left-6 border-b border-gray-300" />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="block aspect-[3/1] w-full touch-none rounded-xl border border-gray-300 bg-white"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              aria-label="Draw your signature here"
            />
            {!hasInk && (
              <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-gray-400">Draw your signature here</span>
            )}
            <span className="pointer-events-none absolute right-6 bottom-[22%] left-6 border-b border-gray-300" />
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearPad} disabled={!hasInk}>
            Clear
          </button>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
        <input type="checkbox" className="mt-1 h-5 w-5 flex-none accent-blue-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I have read this document and agree to sign it electronically. I consent to using electronic records and signatures, and I understand
          my electronic signature is legally binding to the extent allowed by the Information Technology Act, 2000 (India) and the U.S. ESIGN
          Act.
        </span>
      </label>

      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      <button className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending ? "Signing..." : "Sign document"}
      </button>
      <p className="text-center text-xs text-gray-500">
        Your IP address, browser and the time are recorded with your signature in the audit trail.
      </p>
    </form>
  );
}

// ------------------------------------------------------------------ decline

function DeclineBox({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit } = useServerForm(declineAction);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (!open) {
    return (
      <p className="text-center text-sm text-gray-500">
        Don’t want to sign?{" "}
        <button type="button" className="font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900" onClick={() => setOpen(true)}>
          Decline
        </button>
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h2 className="font-semibold">Decline to sign</h2>
      <p className="text-sm text-gray-600">The sender will be told, and the request will be closed for everyone.</p>
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="decline-reason">Reason (optional, shared with the sender)</label>
        <textarea id="decline-reason" name="reason" maxLength={500} rows={3} className="input" placeholder="e.g. The payment terms are wrong" />
      </div>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <ConfirmButton variant="danger" confirmText="Decline this agreement? This can't be undone." confirmLabel="Yes, decline" pending={pending} pendingLabel="Declining...">
          Decline
        </ConfirmButton>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Keep reviewing
        </button>
      </div>
    </form>
  );
}
