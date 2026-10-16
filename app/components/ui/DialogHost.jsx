"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import Button from "./Button";
import { Dialog } from "./Dialog";
import { Field, Input } from "./Field";
import { cn } from "./cn";
import { registerDialogs } from "./notify";

/**
 * Shows the dialogs asked for with confirmDialog() / promptDialog() — one at a
 * time, in order. Mounted once by <UIProvider>.
 */
export default function DialogHost() {
  const [queue, setQueue] = useState([]);
  const [value, setValue] = useState("");
  const current = queue[0];
  const answered = useRef(false);

  useEffect(() => registerDialogs((request) => setQueue((q) => [...q, request])), []);

  useEffect(() => {
    answered.current = false;
    if (current?.kind === "prompt") setValue(current.defaultValue ?? "");
  }, [current]);

  const answer = (result) => {
    if (!current || answered.current) return;
    answered.current = true;
    current.resolve(result);
    setQueue((q) => q.slice(1));
  };
  const cancel = () => answer(current?.kind === "prompt" ? null : false);
  const ok = () => answer(current?.kind === "prompt" ? value : true);

  const danger = !!current?.danger;
  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <Dialog
      open={!!current}
      onClose={cancel}
      size="sm"
      layer="z-[400]"
      footer={
        <>
          <Button variant="ghost" onClick={cancel}>
            {current?.cancelLabel || "Cancel"}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={ok} disabled={current?.kind === "prompt" && current?.required && !value.trim()}>
            {current?.confirmLabel || (current?.kind === "prompt" ? "OK" : danger ? "Delete" : "Confirm")}
          </Button>
        </>
      }
    >
      {current && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ok();
          }}
          className="space-y-4"
        >
          <div className="flex gap-4">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", danger ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand")}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 pt-1.5">
              <h2 className="text-base font-semibold text-fg">{current.title}</h2>
              {current.message && <p className="mt-1 whitespace-pre-line text-sm text-muted">{current.message}</p>}
            </div>
          </div>
          {current.kind === "prompt" && (
            <Field label={current.label}>
              {({ id }) => (
                <Input id={id} autoFocus value={value} placeholder={current.placeholder} onChange={(e) => setValue(e.target.value)} />
              )}
            </Field>
          )}
        </form>
      )}
    </Dialog>
  );
}
