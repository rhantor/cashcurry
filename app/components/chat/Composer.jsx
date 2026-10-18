"use client";
// Writing a message: words, photos and files (up to 32 MB each — picked,
// pasted or dropped on the chat), a reply or an edit in progress shown above.
// Enter sends on a computer; Shift+Enter is a new line. Phones use the button.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CornerUpLeft, FileText, Paperclip, Pencil, SendHorizontal, X } from "lucide-react";
import { Button, cn, toast } from "@/app/components/ui";
import { checkFiles, previewOf } from "@/lib/chat/model";
import StickerPicker from "./StickerPicker";

const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

const Composer = forwardRef(function Composer({ onSend, onSaveEdit, onSticker, user, replyTo, editing, onCancel, disabled }, ref) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const area = useRef(null);
  const picker = useRef(null);

  const add = (list) => {
    const { ok, tooBig } = checkFiles([...list]);
    if (tooBig.length) toast.error("Too big to send", { description: `${tooBig.map((f) => f.name).join(", ")} — files can be up to 32 MB` });
    if (ok.length) setFiles((f) => [...f, ...ok].slice(0, 10));
  };
  useImperativeHandle(ref, () => ({ addFiles: add, focus: () => area.current?.focus() }));

  // editing: start from the message's words
  useEffect(() => {
    if (editing) {
      setText(editing.text || "");
      setFiles([]);
      area.current?.focus();
    }
  }, [editing]);
  useEffect(() => {
    if (replyTo) area.current?.focus();
  }, [replyTo]);

  // grow with the text, up to about six lines
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const send = async () => {
    if (busy || disabled) return;
    if (!text.trim() && !files.length) return;
    setBusy(true);
    try {
      if (editing) await onSaveEdit(text);
      else await onSend({ text, files, onProgress: setProgress });
      setText("");
      setFiles([]);
    } catch (e) {
      toast.error(editing ? "Couldn't save the change" : "Couldn't send", { description: e?.message });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const banner = editing ? { icon: Pencil, label: "Editing your message", text: editing.text } : replyTo ? { icon: CornerUpLeft, label: `Replying to ${replyTo.byName || "a message"}`, text: previewOf(replyTo) } : null;

  return (
    <div className="border-t border-line bg-surface px-3 pb-3 pt-2">
      {banner && (
        <div className="mb-2 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs">
          <banner.icon className="mt-0.5 size-3.5 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-fg">{banner.label}</p>
            <p className="truncate text-muted">{banner.text}</p>
          </div>
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => {
              if (editing) setText("");
              onCancel();
            }}
            className="rounded p-0.5 text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {files.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative flex shrink-0 items-center gap-2 rounded-xl border border-line bg-surface-2 py-1.5 pl-2 pr-7 text-xs">
              {f.type.startsWith("image/") ? (
                <img src={URL.createObjectURL(f)} alt="" className="size-9 rounded-lg object-cover" />
              ) : (
                <FileText className="size-5 text-muted" />
              )}
              <span className="max-w-32 truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, n) => n !== i))} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-fg">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {busy && files.length > 0 && (
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-brand transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <div className="flex items-end gap-2">
        {!editing && (
          <>
            <button type="button" aria-label="Attach photos or files" onClick={() => picker.current?.click()} disabled={disabled} className="mb-0.5 rounded-xl p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50">
              <Paperclip className="size-5" />
            </button>
            <input ref={picker} type="file" multiple hidden onChange={(e) => (add(e.target.files || []), (e.target.value = ""))} />
            {onSticker && <StickerPicker user={user} onPick={onSticker} disabled={disabled} />}
          </>
        )}
        <textarea
          ref={area}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={disabled ? "You can't write here" : "Write a message…"}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const pasted = [...(e.clipboardData?.files || [])];
            if (pasted.length && !editing) {
              e.preventDefault();
              add(pasted);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isTouch()) {
              e.preventDefault();
              send();
            }
            if (e.key === "Escape" && (editing || replyTo)) onCancel();
          }}
          className={cn("max-h-40 min-h-10 flex-1 resize-none rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-subtle focus:border-brand/50 focus:bg-surface")}
        />
        <Button icon={SendHorizontal} size="icon" aria-label={editing ? "Save" : "Send"} loading={busy} disabled={disabled || (!text.trim() && !files.length)} onClick={send} className="mb-0.5 shrink-0" />
      </div>
    </div>
  );
});

export default Composer;
