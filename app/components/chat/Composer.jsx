"use client";
// Writing a message: one rounded box with attach, stickers and emoji on the
// left, the words in the middle and a round send button on the right. Photos
// and files (up to 32 MB each — picked, pasted or dropped on the chat) wait
// above as thumbnails; a reply or an edit in progress shows as a card with a
// coloured edge. Enter sends on a computer; Shift+Enter is a new line.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Bold, Check, Code, CornerUpLeft, FileText, Italic, List, ListOrdered, Paperclip, Pencil, SendHorizontal, Smile, Strikethrough, TextQuote, Type, X } from "lucide-react";
import { Popover, cn, toast } from "@/app/components/ui";
import { checkFiles, previewOf } from "@/lib/chat/model";
import { toggleList, toggleMark } from "@/lib/chat/format";
import StickerPicker from "./StickerPicker";

const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const size = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const EMOJI = "😀 😂 😊 😍 🥰 😎 🤔 😅 😭 😡 👍 👎 👏 🙏 💪 👌 ✌️ 🤝 🙌 👋 ❤️ 🔥 ⭐ ✅ ❌ ⚠️ 🎉 💯 💰 💵 🧾 📦 🚚 🍛 🍗 🍚 ☕ 🥤 🕐 📞".split(" ");
const ICON = "flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-brand disabled:opacity-40";

function EmojiPicker({ onPick, disabled }) {
  return (
    <Popover
      align="start"
      width={292}
      className="p-2"
      trigger={({ ref, toggle }) => (
        <button ref={ref} type="button" aria-label="Emoji" onClick={toggle} disabled={disabled} className={ICON}>
          <Smile className="size-5" />
        </button>
      )}
    >
      {() => (
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => onPick(e)} className="rounded-lg p-1 text-xl leading-none transition-transform hover:scale-125 hover:bg-surface-2">
              {e}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

// the formatting buttons: what each does to the selected words
const TOOLS = [
  { label: "Bold", icon: Bold, keys: "Ctrl+B", mark: "*" },
  { label: "Italic", icon: Italic, keys: "Ctrl+I", mark: "_" },
  { label: "Strikethrough", icon: Strikethrough, mark: "~" },
  { label: "Code", icon: Code, mark: "`" },
  { label: "Bulleted list", icon: List, list: "ul" },
  { label: "Numbered list", icon: ListOrdered, list: "ol" },
  { label: "Quote", icon: TextQuote, quote: true },
];

const Composer = forwardRef(function Composer({ onSend, onSaveEdit, onSticker, user, replyTo, editing, onCancel, disabled }, ref) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [focused, setFocused] = useState(false);
  const [tools, setTools] = useState(false);
  const area = useRef(null);
  const picker = useRef(null);

  const add = (list) => {
    const { ok, tooBig } = checkFiles([...list]);
    if (tooBig.length) toast.error("Too big to send", { description: `${tooBig.map((f) => f.name).join(", ")} — files can be up to 32 MB` });
    if (ok.length) setFiles((f) => [...f, ...ok].slice(0, 10));
  };
  useImperativeHandle(ref, () => ({ addFiles: add, focus: () => area.current?.focus() }));

  // thumbnails for photos waiting to go (and let go of them after)
  const previews = useMemo(() => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

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

  // an emoji goes where the cursor is
  const insert = (e) => {
    const el = area.current;
    const at = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText((t) => t.slice(0, at) + e + t.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + e.length, at + e.length);
    });
  };

  // apply a formatting button to the selection, keeping the selection
  const apply = (tool) => {
    const el = area.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    let r;
    if (tool.mark) r = toggleMark(text, start, end, tool.mark);
    else if (tool.list) r = toggleList(text, start, end, tool.list);
    else {
      // quote: "> " at the start of each selected line (or off again)
      const ls = text.lastIndexOf("\n", start - 1) + 1;
      const nl = text.indexOf("\n", end);
      const le = nl === -1 ? text.length : nl;
      const lines = text.slice(ls, le).split("\n");
      const off = lines.every((l) => /^\s*>\s?/.test(l));
      const next = lines.map((l) => (off ? l.replace(/^\s*>\s?/, "") : `> ${l}`)).join("\n");
      r = { text: text.slice(0, ls) + next + text.slice(le), start: ls, end: ls + next.length };
    }
    setText(r.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(r.start, r.end);
    });
  };

  const ready = !disabled && (text.trim() || files.length);
  const send = async () => {
    if (busy || !ready) return;
    setBusy(true);
    try {
      if (editing) await onSaveEdit(text);
      else await onSend({ text, files, onProgress: setProgress });
      setText("");
      setFiles([]);
      area.current?.focus();
    } catch (e) {
      toast.error(editing ? "Couldn't save the change" : "Couldn't send", { description: e?.message });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const banner = editing ? { icon: Pencil, label: "Editing your message", text: editing.text } : replyTo ? { icon: CornerUpLeft, label: `Replying to ${replyTo.byName || "a message"}`, text: previewOf(replyTo) } : null;

  return (
    <div className="border-t border-line/70 bg-surface/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:px-4">
      <div
        className={cn(
          "overflow-hidden rounded-[1.6rem] border bg-surface-2 transition-all",
          focused ? "border-brand/40 bg-surface shadow-[0_0_0_4px_var(--color-brand-soft)]" : "border-transparent"
        )}
      >
        {/* replying to / editing */}
        {banner && (
          <div className="flex items-start gap-2.5 px-3 pt-2.5">
            <div className="flex min-w-0 flex-1 gap-2.5 rounded-xl bg-brand-soft/60 py-2 pl-2 pr-3">
              <span className="w-1 shrink-0 rounded-full bg-brand" />
              <div className="min-w-0 flex-1 text-xs">
                <p className="flex items-center gap-1 font-semibold text-brand">
                  <banner.icon className="size-3.5" />
                  {banner.label}
                </p>
                <p className="truncate text-muted">{banner.text}</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => {
                if (editing) setText("");
                onCancel();
              }}
              className="mt-1 rounded-full p-1 text-muted hover:bg-surface hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* photos and files waiting to go */}
        {files.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-1 pt-3 [scrollbar-width:thin]">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="group relative shrink-0">
                {previews[i] ? (
                  <img src={previews[i]} alt={f.name} className="size-16 rounded-xl object-cover ring-1 ring-line" />
                ) : (
                  <div className="flex h-16 w-40 items-center gap-2 rounded-xl bg-surface px-2.5 ring-1 ring-line">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <FileText className="size-[18px]" />
                    </span>
                    <span className="min-w-0 text-[11px]">
                      <span className="block truncate font-semibold text-fg">{f.name}</span>
                      <span className="text-muted">{size(f.size)}</span>
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((x) => x.filter((_, n) => n !== i))}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-fg text-surface shadow"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {busy && files.length > 0 && (
          <div className="mx-4 mt-2 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}

        {/* formatting */}
        {tools && (
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-line/70 px-2 pt-1.5 pb-1 [scrollbar-width:none]">
            {TOOLS.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.keys ? `${t.label} (${t.keys})` : t.label}
                aria-label={t.label}
                onMouseDown={(e) => e.preventDefault()} // keep the selection in the text box
                onClick={() => apply(t)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-fg"
              >
                <t.icon className="size-4" />
              </button>
            ))}
            <span className="ml-auto hidden shrink-0 pr-1 text-[10px] text-subtle sm:block">*bold* _italic_ ~strike~ `code`</span>
          </div>
        )}

        {/* the line you type on */}
        <div className="flex items-end gap-0.5 p-1.5">
          {!editing && (
            <>
              <button type="button" aria-label="Attach photos or files" onClick={() => picker.current?.click()} disabled={disabled} className={ICON}>
                <Paperclip className="size-5" />
              </button>
              <input ref={picker} type="file" multiple hidden onChange={(e) => (add(e.target.files || []), (e.target.value = ""))} />
              {onSticker && <StickerPicker user={user} onPick={onSticker} disabled={disabled} className={ICON} />}
            </>
          )}
          <EmojiPicker onPick={insert} disabled={disabled} />
          <button
            type="button"
            aria-label={tools ? "Hide formatting" : "Formatting"}
            aria-pressed={tools}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTools((v) => !v)}
            disabled={disabled}
            className={cn(ICON, tools && "bg-surface text-brand")}
          >
            <Type className="size-[18px]" />
          </button>
          <textarea
            ref={area}
            rows={1}
            value={text}
            disabled={disabled}
            placeholder={disabled ? "You can't write here" : editing ? "Change your message…" : "Message"}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onPaste={(e) => {
              const pasted = [...(e.clipboardData?.files || [])];
              if (pasted.length && !editing) {
                e.preventDefault();
                add(pasted);
              }
            }}
            onKeyDown={(e) => {
              const mod = e.ctrlKey || e.metaKey;
              if (mod && (e.key === "b" || e.key === "i")) {
                e.preventDefault();
                apply(TOOLS[e.key === "b" ? 0 : 1]);
                return;
              }
              // Enter in a list carries the list on to the next line
              if (e.key === "Enter" && e.shiftKey) {
                const el = e.currentTarget;
                const ls = text.lastIndexOf("\n", el.selectionStart - 1) + 1;
                const line = text.slice(ls, el.selectionStart);
                const m = /^(\s*)([-•]|(\d{1,3})[.)])\s+(.*)$/.exec(line);
                if (m) {
                  e.preventDefault();
                  const bullet = m[3] ? `${Number(m[3]) + 1}. ` : `${m[2]} `;
                  // an empty item ends the list
                  const r = m[4] ? { text: text.slice(0, el.selectionStart) + "\n" + m[1] + bullet + text.slice(el.selectionEnd), at: el.selectionStart + 1 + m[1].length + bullet.length } : { text: text.slice(0, ls) + text.slice(el.selectionEnd), at: ls };
                  setText(r.text);
                  requestAnimationFrame(() => el.setSelectionRange(r.at, r.at));
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey && !isTouch()) {
                e.preventDefault();
                send();
              }
              if (e.key === "Escape" && (editing || replyTo)) onCancel();
            }}
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-snug text-fg outline-none placeholder:text-subtle"
          />
          <button
            type="button"
            aria-label={editing ? "Save" : "Send"}
            onClick={send}
            disabled={!ready || busy}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
              ready ? "scale-100 bg-gradient-to-br from-brand to-brand/80 text-white shadow-md hover:shadow-lg active:scale-95" : "scale-90 bg-line/70 text-subtle"
            )}
          >
            {busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : editing ? <Check className="size-[18px]" /> : <SendHorizontal className="size-[18px] translate-x-px" />}
          </button>
        </div>
      </div>
      <p className="mt-1 hidden px-4 text-[10px] text-subtle sm:block">
        <kbd className="font-sans font-semibold">Enter</kbd> to send · <kbd className="font-sans font-semibold">Shift + Enter</kbd> for a new line
      </p>
    </div>
  );
});

export default Composer;
