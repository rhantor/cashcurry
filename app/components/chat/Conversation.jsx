"use client";
// One open chat: its header (name, who's in it, mute, managing a group), the
// messages with a line for each day, ✓ / ✓✓ and "Seen by", reactions, and the
// message box. New messages scroll into view when you're at the bottom;
// otherwise a "new messages" button takes you there. It's marked read while
// it is on screen.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, BellOff, Bell, Building2, Globe2, MoreVertical, Settings2, Tag, Users } from "lucide-react";
import { Avatar, Button, Menu, Skeleton, cn, confirmDialog, toast } from "@/app/components/ui";
import { canMakeGroups, canRemoveForEveryone, chatTitle, dayLabel, seenBy, timeOf } from "@/lib/chat/model";
import { deleteMessage, editMessage, hideMessage, markRead, react, removeMessage, sendMessage, sendSticker, setChatMuted } from "@/lib/chat/client";
import { personName } from "@/lib/people";
import { useMessages, useReads } from "./useChat";
import Message from "./Message";
import Composer from "./Composer";
import PhotoViewer from "./PhotoViewer";

export const chatIcon = (kind) => (kind === "company" ? Globe2 : kind === "branch" ? Building2 : kind === "group" ? Users : null);

function subtitle(chat, branchName) {
  if (chat.kind === "company") return "Everyone in the company";
  if (chat.kind === "branch") return `Everyone at ${branchName || chat.name || "the branch"}`;
  if (chat.kind === "group") return `${chat.members?.length || 0} people`;
  return "Personal chat";
}

const RUN_GAP = 5 * 60 * 1000; // messages within 5 minutes from one person read as one run

export default function Conversation({ chat, user, peopleById, branchName, muted, onBack, onManage, onForward, onLabels }) {
  const companyId = user.companyId;
  const me = user.uid;
  const { messages: all, loading, hasMore, more } = useMessages(companyId, chat.id);
  const reads = useReads(companyId, chat.id);
  // without the ones this person deleted for themselves
  const hiddenKey = (reads[me]?.hidden || []).join(",");
  const messages = useMemo(() => {
    const hidden = new Set(hiddenKey.split(","));
    return all.filter((m) => !hidden.has(m.id));
  }, [all, hiddenKey]);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [photos, setPhotos] = useState(null); // { list, start }
  const [below, setBelow] = useState(0); // new messages under the screen
  const [showJump, setShowJump] = useState(false);
  const scroller = useRef(null);
  const composer = useRef(null);
  const atBottom = useRef(true);
  const firstId = useRef(null);
  const lastId = useRef(null);

  const title = chat.title || chatTitle(chat, me, peopleById);
  const Icon = chatIcon(chat.kind);

  const toBottom = (smooth) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setBelow(0);
  };

  // stay at the bottom as messages arrive — unless reading further up
  useEffect(() => {
    const el = scroller.current;
    if (!el || !messages.length) return;
    const olderLoaded = firstId.current && messages[0]?.id !== firstId.current;
    const newest = messages[messages.length - 1];
    const arrived = lastId.current && newest.id !== lastId.current;
    if (atBottom.current && !olderLoaded) el.scrollTop = el.scrollHeight;
    else if (arrived && newest.byUid !== me) setBelow((n) => n + 1);
    firstId.current = messages[0].id;
    lastId.current = newest.id;
  }, [messages, me]);
  useEffect(() => {
    atBottom.current = true;
    firstId.current = null;
    lastId.current = null;
    setReplyTo(null);
    setEditing(null);
    setBelow(0);
  }, [chat.id]);

  // seen while it's open and the page is visible
  const lastAt = timeOf(chat.lastMessage?.at);
  useEffect(() => {
    if (!companyId || !me) return;
    const mark = () => document.visibilityState === "visible" && markRead(companyId, chat.id, me).catch(() => {});
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [companyId, chat.id, me, lastAt]);

  // ✓ sent, ✓✓ seen (personal chats); "Seen by N" under my latest (groups)
  const lastMine = useMemo(() => [...messages].reverse().find((m) => m.byUid === me && !m.deleted), [messages, me]);
  const statusOf = (m) => {
    if (m.byUid !== me) return null;
    if (m.pending) return "sending";
    if (chat.kind !== "direct") return "sent";
    return seenBy(m, reads).length ? "seen" : "sent";
  };
  const seenNote = (m) => {
    if (chat.kind === "direct" || !lastMine || m.id !== lastMine.id) return "";
    const who = seenBy(m, reads);
    return who.length ? `Seen by ${who.length === 1 ? peopleById[who[0]]?.name || "1" : who.length}` : "";
  };

  const remove = async (m) => {
    if (!(await confirmDialog({ title: "Delete for everyone?", message: "Everyone in this chat will see “Message deleted” instead.", confirmLabel: "Delete for everyone", danger: true }))) return;
    try {
      await deleteMessage(companyId, chat.id, m);
    } catch (e) {
      toast.error("Couldn't delete", { description: e?.code === "permission-denied" ? "Messages can be deleted for 15 minutes after sending." : e?.message });
    }
  };
  // management removes anyone's message for everyone (not in personal chats)
  const canRemove = canRemoveForEveryone(user.role, chat);
  const removeForAll = async (m) => {
    if (!(await confirmDialog({ title: "Remove for everyone?", message: `Everyone in this chat will see “Removed by ${personName(user) || "you"}” instead${m.byName ? ` of ${m.byName}'s message` : ""}.`, confirmLabel: "Remove", danger: true }))) return;
    removeMessage(companyId, chat.id, m, user).catch((e) => toast.error("Couldn't remove", { description: e?.message }));
  };
  // "Delete for me": gone from your view only; the others still see it
  const hide = async (m) => {
    if (!(await confirmDialog({ title: "Delete for me?", message: "It goes from your chat only — the others still see it.", confirmLabel: "Delete for me", danger: true }))) return;
    hideMessage(companyId, chat.id, me, m.id).catch((e) => toast.error("Couldn't delete", { description: e?.message }));
  };
  const onReact = (m, emoji) => react(companyId, chat.id, m.id, me, emoji).catch((e) => toast.error("Couldn't react", { description: e?.message }));

  const menu = [
    { label: muted ? "Turn notifications on" : "Mute notifications", icon: muted ? Bell : BellOff, onSelect: () => setChatMuted(companyId, me, chat.id, !muted).catch((e) => toast.error("Couldn't save", { description: e?.message })) },
    onLabels && { label: "Labels", icon: Tag, onSelect: onLabels },
    chat.kind === "group" && canMakeGroups(user.role) && { label: "Manage group", icon: Settings2, onSelect: onManage },
  ].filter(Boolean);

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-bg"
      onDragOver={(e) => {
        if ([...(e.dataTransfer?.types || [])].includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        composer.current?.addFiles(e.dataTransfer.files || []);
      }}
    >
      <header className="flex items-center gap-3 border-b border-line bg-surface/90 px-3 py-2.5 backdrop-blur">
        {onBack && (
          <button type="button" aria-label="Back to chats" onClick={onBack} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg md:hidden">
            <ArrowLeft className="size-5" />
          </button>
        )}
        {Icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand/70 text-white shadow-sm">
            <Icon className="size-[18px]" />
          </span>
        ) : (
          <Avatar name={title} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-fg">{title}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted">
            {muted && <BellOff className="size-3" />}
            {subtitle(chat, branchName)}
          </p>
        </div>
        {chat.kind === "group" && (
          <div className="hidden -space-x-2 sm:flex">
            {(chat.members || []).slice(0, 4).map((u) => (
              <span key={u} className="rounded-full ring-2 ring-surface">
                <Avatar name={peopleById[u]?.name || "?"} size="sm" />
              </span>
            ))}
          </div>
        )}
        <Menu
          align="end"
          width={220}
          items={menu}
          trigger={(p) => (
            <button {...p} type="button" aria-label="Chat options" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
              <MoreVertical className="size-5" />
            </button>
          )}
        />
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          atBottom.current = fromBottom < 80;
          setShowJump(fromBottom > 400);
          if (atBottom.current) setBelow(0);
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,var(--color-line)_1px,transparent_0)] [background-size:22px_22px] px-3 py-4 sm:px-6"
      >
        {hasMore && (
          <div className="pb-3 text-center">
            <Button size="sm" variant="secondary" onClick={more}>
              Load earlier messages
            </Button>
          </div>
        )}
        {loading && !messages.length ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={cn("h-12 w-2/3", i % 2 && "ml-auto")} rounded="rounded-2xl" />
            ))}
          </div>
        ) : !messages.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="text-4xl">👋</span>
            <p className="text-sm font-semibold text-fg">No messages yet</p>
            <p className="text-xs text-muted">Say hello to start the conversation.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
            const sameAsPrev = prev && !newDay && prev.byUid === m.byUid && timeOf(m.createdAt) - timeOf(prev.createdAt) < RUN_GAP;
            const sameAsNext = next && next.byUid === m.byUid && dayLabel(next.createdAt) === dayLabel(m.createdAt) && timeOf(next.createdAt) - timeOf(m.createdAt) < RUN_GAP;
            return (
              <div key={m.id} className={cn(sameAsPrev ? "mt-0.5" : "mt-3", m.reactions && Object.keys(m.reactions).length && "mb-2")}>
                {newDay && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-muted shadow-sm ring-1 ring-line">{dayLabel(m.createdAt)}</span>
                  </div>
                )}
                <Message
                  msg={m}
                  me={me}
                  first={!sameAsPrev}
                  showName={chat.kind !== "direct" && !sameAsPrev}
                  showAvatar={chat.kind !== "direct" && !sameAsNext}
                  status={statusOf(m)}
                  seenNote={seenNote(m)}
                  peopleById={peopleById}
                  onReply={(x) => {
                    setEditing(null);
                    setReplyTo(x);
                  }}
                  onEdit={(x) => {
                    setReplyTo(null);
                    setEditing(x);
                  }}
                  onDelete={remove}
                  onHide={hide}
                  canRemove={canRemove}
                  onRemove={removeForAll}
                  onForward={onForward}
                  onReact={onReact}
                  onOpenPhoto={(list, start) => setPhotos({ list, start })}
                />
              </div>
            );
          })
        )}
      </div>

      {(showJump || below > 0) && (
        <button
          type="button"
          onClick={() => toBottom(true)}
          className="absolute bottom-24 right-5 flex items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-xs font-semibold text-fg shadow-lg ring-1 ring-line transition hover:bg-surface-2"
        >
          <ArrowDown className="size-4" />
          {below > 0 ? `${below} new` : "Latest"}
        </button>
      )}

      <Composer
        ref={composer}
        replyTo={replyTo}
        editing={editing}
        onCancel={() => {
          setReplyTo(null);
          setEditing(null);
        }}
        onSend={async ({ text, files, onProgress }) => {
          atBottom.current = true;
          await sendMessage(companyId, chat.id, user, { text, files, replyTo, onProgress });
          setReplyTo(null);
          toBottom(true);
        }}
        user={user}
        onSticker={(st) => {
          atBottom.current = true;
          sendSticker(companyId, chat.id, user, st)
            .then(() => toBottom(true))
            .catch((e) => toast.error("Couldn't send the sticker", { description: e?.message }));
        }}
        onSaveEdit={async (text) => {
          try {
            await editMessage(companyId, chat.id, editing.id, text);
          } catch (e) {
            throw new Error(e?.code === "permission-denied" ? "Messages can be changed for 15 minutes after sending." : e?.message);
          }
          setEditing(null);
        }}
      />

      {dragging && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand bg-brand-soft/80 text-sm font-semibold text-brand">
          Drop to attach (up to 32 MB each)
        </div>
      )}
      {photos && <PhotoViewer photos={photos.list} start={photos.start} onClose={() => setPhotos(null)} />}
    </div>
  );
}
