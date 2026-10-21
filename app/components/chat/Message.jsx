"use client";
// One chat message: who, what it replies to or was forwarded from, the words,
// photos (open in a viewer) and files, reactions, the time with ✓ sent / ✓✓
// seen on your own, "edited" / "Message deleted". On hover (always on phones):
// react, reply, forward — and edit / delete your own within 15 minutes.
import { VoicePlayer } from "@/app/components/common/Voice";
import { useState } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Clock3, CornerUpLeft, Download, EyeOff, FileText, Forward, MoreHorizontal, Pencil, Share2, ShieldX, SmilePlus, Trash2 } from "lucide-react";
import { Avatar, Menu, Popover, cn } from "@/app/components/ui";
import { REACTIONS, canChangeMessage, canForward, reactionSummary, timeOf } from "@/lib/chat/model";
import { blocks } from "@/lib/chat/format";
import { downloadFile, shareMessage } from "@/lib/chat/client";

const size = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
// a steady colour per person for names in groups
const NAME_TONES = ["text-brand", "text-info", "text-warning", "text-danger", "text-success"];
const toneOf = (uid = "") => NAME_TONES[[...uid].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_TONES.length];

// one line of formatted words (lib/chat/format.js) — drawn as elements, never HTML
function Pieces({ pieces, mine }) {
  return pieces.map((p, i) => {
    if (p.link)
      return (
        <a key={i} href={p.text} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
          {p.text}
        </a>
      );
    let el = p.text;
    if (p.code) el = <code className={cn("rounded px-1 py-px font-mono text-[12.5px]", mine ? "bg-white/20" : "bg-surface-2 text-fg")}>{el}</code>;
    if (p.strike) el = <s className="opacity-80">{el}</s>;
    if (p.italic) el = <em>{el}</em>;
    if (p.bold) el = <strong className="font-semibold">{el}</strong>;
    return <span key={i}>{el}</span>;
  });
}

function Text({ text, mine }) {
  return (
    <div className="space-y-1 break-words text-[14px] leading-relaxed">
      {blocks(text).map((b, i) => {
        if (b.type === "ul" || b.type === "ol") {
          const List = b.type === "ul" ? "ul" : "ol";
          return (
            <List key={i} start={b.start} className={cn("space-y-0.5 pl-5", b.type === "ul" ? "list-disc" : "list-decimal", mine ? "marker:text-white/70" : "marker:text-brand")}>
              {b.items.map((it, j) => (
                <li key={j} className="pl-0.5">
                  <Pieces pieces={it} mine={mine} />
                </li>
              ))}
            </List>
          );
        }
        if (b.type === "quote")
          return (
            <blockquote key={i} className={cn("border-l-[3px] pl-2.5 italic", mine ? "border-white/60 text-white/90" : "border-brand/60 text-muted")}>
              {b.lines.map((l, j) => (
                <span key={j} className="block">
                  <Pieces pieces={l} mine={mine} />
                </span>
              ))}
            </blockquote>
          );
        return (
          <p key={i} className="whitespace-pre-wrap">
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && "\n"}
                <Pieces pieces={l} mine={mine} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function Files({ files, mine, onOpenPhoto }) {
  const photos = files.filter((f) => String(f.type).startsWith("image/"));
  const voices = files.filter((f) => f.voice);
  const others = files.filter((f) => !String(f.type).startsWith("image/") && !f.voice);
  return (
    <div className="space-y-1.5">
      {voices.map((f) => <VoicePlayer key={f.path || f.url} url={f.url} duration={f.duration} mine={mine} />)}
      {photos.length > 0 && (
        <div className={cn("grid gap-1 overflow-hidden rounded-xl", photos.length > 1 && "grid-cols-2")}>
          {photos.slice(0, 4).map((f, i) => (
            <button key={f.path || f.url} type="button" onClick={() => onOpenPhoto(photos, i)} className="relative block overflow-hidden bg-surface-2">
              <img src={f.url} alt={f.name} loading="lazy" className={cn("w-full bg-surface-2 object-cover transition-transform hover:scale-[1.02]", photos.length > 1 ? "aspect-square" : "max-h-80 min-h-40 min-w-48")} />
              {i === 3 && photos.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-bold text-white">+{photos.length - 4}</span>}
            </button>
          ))}
        </div>
      )}
      {others.map((f) => (
        <div key={f.path || f.url} className={cn("flex items-center gap-1 rounded-xl text-xs transition-colors", mine ? "bg-white/15" : "bg-surface-2")}>
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2.5 pl-3 pr-1 hover:opacity-90">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", mine ? "bg-white/20" : "bg-brand-soft text-brand")}>
              <FileText className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{f.name}</span>
              <span className="opacity-75">{size(f.size || 0)}</span>
            </span>
          </a>
          <button type="button" aria-label={`Download ${f.name}`} onClick={() => downloadFile(f)} className={cn("mr-1.5 rounded-lg p-2 transition-colors", mine ? "hover:bg-white/20" : "hover:bg-line/60")}>
            <Download className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** status on your own messages: "sending" | "sent" | "seen" */
function Ticks({ status }) {
  if (status === "sending") return <Clock3 className="size-3" />;
  if (status === "seen") return <CheckCheck className="size-3.5 text-sky-200" />;
  return <Check className="size-3.5" />;
}

export default function Message({ msg, me, showName, showAvatar, first, status, seenNote, peopleById = {}, canRemove, onReply, onEdit, onDelete, onRemove, onHide, onForward, onReact, onOpenPhoto }) {
  const [picking, setPicking] = useState(false);
  const mine = msg.byUid === me;
  const at = timeOf(msg.createdAt);
  const changeable = canChangeMessage(msg, me);
  const reactions = reactionSummary(msg.reactions, me);
  const myReaction = msg.reactions?.[me];
  const items = [
    !msg.deleted && { label: "Reply", icon: CornerUpLeft, onSelect: () => onReply(msg) },
    canForward(msg) && { label: "Forward", icon: Forward, onSelect: () => onForward(msg) },
    canForward(msg) && !msg.sticker && { label: "Share to WhatsApp…", icon: Share2, onSelect: () => shareMessage(msg) },
    changeable && msg.text && { label: "Edit", icon: Pencil, onSelect: () => onEdit(msg) },
    changeable && { label: "Delete for everyone", icon: Trash2, danger: true, onSelect: () => onDelete(msg) },
    // management, for anyone's message (or their own after 15 minutes)
    !changeable && canRemove && !msg.deleted && { label: "Remove for everyone", icon: ShieldX, danger: true, onSelect: () => onRemove(msg) },
    { label: "Delete for me", icon: EyeOff, danger: true, onSelect: () => onHide(msg) },
  ].filter(Boolean);
  const sticker = !msg.deleted && msg.sticker;
  const onlyPhotos = !msg.deleted && !msg.text && msg.files?.length > 0 && msg.files.every((f) => String(f.type).startsWith("image/")) && !msg.replyTo && !msg.forwarded;

  return (
    <div className={cn("group flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row")}>
      <div className="w-8 shrink-0">{!mine && showAvatar && <Avatar name={msg.byName} size="sm" />}</div>
      <div className={cn("flex min-w-0 max-w-[80%] flex-col sm:max-w-[62%]", mine ? "items-end" : "items-start")}>
        {!mine && showName && <span className={cn("mb-0.5 px-1 text-[11px] font-semibold", toneOf(msg.byUid))}>{msg.byName}</span>}
        {sticker ? (
          <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
            <img src={sticker.url} alt={sticker.name || "Sticker"} title={sticker.name} className="size-32 object-contain drop-shadow-sm sm:size-36" />
            <span className="flex items-center gap-1 rounded-full bg-surface/80 px-1.5 text-[10px] text-subtle">
              {at ? format(at, "h:mm a") : ""}
              {mine && status && <Ticks status={status} />}
            </span>
          </div>
        ) : (
        <div
          className={cn(
            "space-y-1.5 rounded-2xl shadow-sm",
            onlyPhotos ? "p-1" : "px-3 py-2",
            msg.deleted ? "rounded-bl-md rounded-br-md bg-surface/60" : mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-surface text-fg ring-1 ring-line/70",
            // a run of messages from one person stacks neatly
            !first && (mine ? "rounded-tr-md" : "rounded-tl-md"),
            msg.deleted && "bg-transparent text-subtle shadow-none ring-1 ring-line"
          )}
        >
          {msg.deleted ? (
            <p className="text-sm italic text-muted">{msg.removedBy?.name ? `Removed by ${msg.removedBy.name}` : "Message deleted"}</p>
          ) : (
            <>
              {msg.forwarded && (
                <p className={cn("flex items-center gap-1 text-[11px] italic", mine ? "text-white/80" : "text-muted")}>
                  <Forward className="size-3" /> Forwarded
                </p>
              )}
              {msg.replyTo && (
                <div className={cn("rounded-lg border-l-[3px] px-2 py-1 text-xs", mine ? "border-white/70 bg-white/10" : "border-brand bg-surface-2")}>
                  <span className="block font-semibold">{msg.replyTo.byName}</span>
                  <span className="line-clamp-2 opacity-80">{msg.replyTo.text}</span>
                </div>
              )}
              {msg.files?.length > 0 && <Files files={msg.files} mine={mine} onOpenPhoto={onOpenPhoto} />}
              {msg.text && <Text text={msg.text} mine={mine} />}
            </>
          )}
          <span className={cn("flex items-center justify-end gap-1 text-[10px]", onlyPhotos ? "px-1.5 pb-0.5" : "-mb-0.5", mine && !msg.deleted ? "text-white/75" : "text-subtle")}>
            {msg.editedAt && !msg.deleted ? "edited · " : ""}
            {at ? format(at, "h:mm a") : ""}
            {mine && !msg.deleted && status && <Ticks status={status} />}
          </span>
        </div>
        )}
        {reactions.length > 0 && (
          <div className={cn("-mt-1.5 flex flex-wrap gap-1", mine ? "justify-end pr-1" : "pl-1")}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                title={r.who.map((u) => peopleById[u]?.name || "Someone").join(", ")}
                onClick={() => onReact(msg, r.mine ? null : r.emoji)}
                className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-xs shadow-sm transition-colors", r.mine ? "border-brand/40 bg-brand-soft" : "border-line bg-surface hover:bg-surface-2")}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="font-semibold tabular-nums text-muted">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
        {seenNote && <span className="mt-0.5 px-1 text-[10px] text-subtle">{seenNote}</span>}
      </div>

      <div className="flex items-center gap-0.5 self-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        {!msg.deleted && (
          <Popover
            align={mine ? "end" : "start"}
            open={picking}
            onOpenChange={setPicking}
            className="p-1"
            trigger={({ ref, toggle }) => (
              <button ref={ref} type="button" aria-label="React" onClick={toggle} className="rounded-lg p-1 text-subtle hover:bg-surface-2 hover:text-fg">
                <SmilePlus className="size-4" />
              </button>
            )}
          >
            {({ close }) => (
              <div className="flex gap-0.5">
                {REACTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-label={`React ${e}`}
                    onClick={() => {
                      onReact(msg, myReaction === e ? null : e);
                      close();
                    }}
                    className={cn("rounded-lg p-1.5 text-xl leading-none transition-transform hover:scale-125", myReaction === e && "bg-brand-soft")}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </Popover>
        )}
          <Menu
            align={mine ? "end" : "start"}
            width={190}
            items={items}
            trigger={(p) => (
              <button {...p} type="button" aria-label="Message options" className="rounded-lg p-1 text-subtle hover:bg-surface-2 hover:text-fg">
                <MoreHorizontal className="size-4" />
              </button>
            )}
          />
      </div>
    </div>
  );
}
