"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSignatureAction } from "@/app/actions/signing";
import type { ActionState } from "@/app/actions/types";

const W = 600;
const H = 200;
const INK = "#0b1b4d";

export function SignForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<"typed" | "drawn">("typed");
  const [typedName, setTypedName] = useState(defaultName);
  const [consent, setConsent] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const ctx = () => canvasRef.current?.getContext("2d") ?? null;

  const clearPad = () => {
    ctx()?.clearRect(0, 0, W, H);
    setHasInk(false);
  };

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ctx();
    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = point(e);
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 0.01, y + 0.01);
    c.stroke();
    setHasInk(true);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    const { x, y } = point(e);
    c.lineTo(x, y);
    c.stroke();
  };
  const onUp = () => {
    drawing.current = false;
  };

  /** Render the typed name to a PNG with the cursive font, on a transparent canvas. */
  async function typedPng(): Promise<string> {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-script").trim() || "cursive";
    const font = `64px ${family}, cursive`;
    try {
      await document.fonts.load(font, typedName);
    } catch {
      /* fall back to the generic cursive family */
    }
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = INK;
    g.textBaseline = "middle";
    let size = 64;
    g.font = font;
    while (g.measureText(typedName).width > W - 40 && size > 20) {
      size -= 4;
      g.font = `${size}px ${family}, cursive`;
    }
    g.fillText(typedName, 20, H / 2);
    return c.toDataURL("image/png");
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!consent) return setState({ error: "Please tick the consent box to continue." });
    if (method === "drawn" && !hasInk) return setState({ error: "Please draw your signature." });
    if (method === "typed" && typedName.trim().length < 2) return setState({ error: "Please type your full name." });
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

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-medium ${active ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`;

  return (
    <form onSubmit={submit} className="card space-y-5">
      <h2 className="text-lg font-semibold">Sign this document</h2>

      <label className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I have read this document and agree to sign it electronically. I consent to the use of electronic records and
          signatures, and understand that my electronic signature is legally binding to the extent permitted by the
          Information Technology Act, 2000 (India) and the U.S. ESIGN Act.
        </span>
      </label>

      <div>
        <div className="mb-3 flex gap-2" role="tablist" aria-label="Signature method">
          <button type="button" role="tab" aria-selected={method === "typed"} className={tabClass(method === "typed")} onClick={() => setMethod("typed")}>Type</button>
          <button type="button" role="tab" aria-selected={method === "drawn"} className={tabClass(method === "drawn")} onClick={() => setMethod("drawn")}>Draw</button>
        </div>

        {method === "typed" ? (
          <div className="space-y-3">
            <label className="label" htmlFor="typedName">Your full name</label>
            <input id="typedName" className="input" maxLength={100} value={typedName} onChange={(e) => setTypedName(e.target.value)} />
            <div className="flex h-28 items-center overflow-hidden rounded-lg border border-dashed border-gray-300 px-5" aria-label="Signature preview">
              <span className="truncate text-5xl" style={{ fontFamily: "var(--font-script), cursive", color: INK }}>{typedName}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="w-full touch-none rounded-lg border border-dashed border-gray-300 bg-white"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              aria-label="Draw your signature here"
            />
            <button type="button" className="btn btn-sm" onClick={clearPad}>Clear</button>
          </div>
        )}
      </div>

      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button className="btn btn-primary w-full py-3" disabled={pending}>{pending ? "Signing..." : "Sign document"}</button>
      <p className="text-xs text-gray-500">
        Your IP address, browser details and the time are recorded with your signature as part of the audit trail.
      </p>
    </form>
  );
}
