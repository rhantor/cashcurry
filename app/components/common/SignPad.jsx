"use client";
// A signature drawn with a finger or mouse (the join link's letter; a manager's
// own signature for vouchers). `value` is a PNG data URL, or null when empty.
import { useCallback, useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/app/components/ui";

export default function SignPad({ value, onChange }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const drawn = useRef(false);
  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1d3a8a";
    drawn.current = false;
  }, []);
  // drawn again when coming back to this step; cleared when Clear is pressed
  useEffect(() => {
    setup();
    if (value) {
      const img = new Image();
      img.onload = () => canvas.current?.getContext("2d").drawImage(img, 0, 0, canvas.current.clientWidth, canvas.current.clientHeight);
      img.src = value;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!value) setup();
  }, [value, setup]);
  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const down = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvas.current.getContext("2d");
    ctx.lineTo(...point(e));
    ctx.stroke();
    drawn.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (drawn.current) onChange(canvas.current.toDataURL("image/png"));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-fg">Sign here</p>
        <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
          <RotateCcw className="size-3.5" /> Clear
        </button>
      </div>
      <canvas
        ref={canvas}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={cn("h-40 w-full touch-none rounded-2xl border-2 border-dashed bg-white", value ? "border-brand/50" : "border-line")}
        aria-label="Signature pad: draw your signature with your finger"
      />
      {!value && <p className="text-xs text-muted">Draw your signature with your finger.</p>}
    </div>
  );
}
