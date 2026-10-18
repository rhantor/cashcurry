"use client";
// One chat message: who and when, what it replies to, the words, photos and
// files, "edited" / "message deleted", and — on hover (always on phones) —
// Reply, and Edit / Delete for your own within 15 minutes.
import { format } from "date-fns";
import { CornerUpLeft, Download, FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Avatar, Menu, cn } from "@/app/components/ui";
import { canChangeMessage, timeOf } from "@/lib/chat/model";

const size = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const LINK = /(https?:\/\/[^\s]+)/g;

function Text({ text }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {String(text)
        .split(LINK)
        .map((part, i) =>
          /^https?:\/\//.test(part) ? (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {part}
            </a>
          ) : (
            part
          )
        )}
    </p>
  );
}

function Files({ files, mine }) {
  const photos = files.filter((f) => String(f.type).startsWith("image/"));
  const others = files.filter((f) => !String(f.type).startsWith("image/"));
  return (
    <div className="space-y-1.5">
      {photos.length > 0 && (
        <div className={cn("grid gap-1", photos.length > 1 && "grid-cols-2")}>
          {photos.map((f) => (
            <a key={f.path || f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl bg-surface-2">
              <img src={f.url} alt={f.name} loading="lazy" className="max-h-72 w-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {others.map((f) => (
        <a
          key={f.path || f.url}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs", mine ? "bg-white/15 hover:bg-white/25" : "bg-surface hover:bg-surface-2")}
        >
          <FileText className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{f.name}</span>
            <span className="opacity-75">{size(f.size || 0)}</span>
          </span>
          <Download className="size-4 shrink-0 opacity-75" />
        </a>
      ))}
    </div>
  );
}

export default function Message({ msg, me, showName, showAvatar, seen, onReply, onEdit, onDelete }) {
  const mine = msg.byUid === me;
  const at = timeOf(msg.createdAt);
  const changeable = canChangeMessage(msg, me);
  const items = [
    !msg.deleted && { label: "Reply", icon: CornerUpLeft, onSelect: () => onReply(msg) },
    changeable && msg.text && { label: "Edit", icon: Pencil, onSelect: () => onEdit(msg) },
    changeable && { label: "Delete", icon: Trash2, danger: true, onSelect: () => onDelete(msg) },
  ].filter(Boolean);

  return (
    <div className={cn("group flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row")}>
      <div className="w-8 shrink-0">{!mine && showAvatar && <Avatar name={msg.byName} size="sm" />}</div>
      <div className={cn("flex min-w-0 max-w-[78%] flex-col sm:max-w-[65%]", mine ? "items-end" : "items-start")}>
        {!mine && showName && <span className="mb-0.5 px-1 text-[11px] font-semibold text-muted">{msg.byName}</span>}
        <div
          className={cn(
            "space-y-1.5 rounded-2xl px-3.5 py-2 shadow-sm",
            mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-surface text-fg ring-1 ring-line",
            msg.deleted && "bg-transparent text-subtle shadow-none ring-1 ring-line"
          )}
        >
          {msg.deleted ? (
            <p className="text-sm italic">Message deleted</p>
          ) : (
            <>
              {msg.replyTo && (
                <div className={cn("rounded-lg border-l-2 px-2 py-1 text-xs", mine ? "border-white/60 bg-white/10" : "border-brand bg-surface-2")}>
                  <span className="block font-semibold">{msg.replyTo.byName}</span>
                  <span className="line-clamp-2 opacity-80">{msg.replyTo.text}</span>
                </div>
              )}
              {msg.files?.length > 0 && <Files files={msg.files} mine={mine} />}
              {msg.text && <Text text={msg.text} />}
            </>
          )}
        </div>
        <span className="mt-0.5 px-1 text-[10px] text-subtle">
          {at ? format(at, "h:mm a") : "sending…"}
          {msg.editedAt && !msg.deleted ? " · edited" : ""}
          {seen ? ` · ${seen}` : ""}
        </span>
      </div>
      {items.length > 0 && (
        <div className="self-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <Menu
            align={mine ? "end" : "start"}
            width={160}
            items={items}
            trigger={(p) => (
              <button {...p} type="button" aria-label="Message options" className="rounded-lg p-1 text-subtle hover:bg-surface-2 hover:text-fg">
                <MoreHorizontal className="size-4" />
              </button>
            )}
          />
        </div>
      )}
    </div>
  );
}
