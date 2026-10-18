"use client";
// One open chat: its header (name, who's in it, mute, managing a group), the
// messages with a line for each day, "seen", and the message box. New
// messages scroll into view when you're at the bottom; it's marked read while
// it is on screen.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BellOff, Bell, Building2, Globe2, MoreVertical, Settings2, Users } from "lucide-react";
import { Avatar, Button, Menu, Skeleton, cn, confirmDialog, toast } from "@/app/components/ui";
import { canMakeGroups, chatTitle, dayLabel, seenBy, timeOf } from "@/lib/chat/model";
import { deleteMessage, editMessage, markRead, sendMessage, setChatMuted } from "@/lib/chat/client";
import { useMessages, useReads } from "./useChat";
import Message from "./Message";
import Composer from "./Composer";

export const chatIcon = (kind) => (kind === "company" ? Globe2 : kind === "branch" ? Building2 : kind === "group" ? Users : null);

function subtitle(chat, peopleById, branchName) {
  if (chat.kind === "company") return "Everyone in the company";
  if (chat.kind === "branch") return `Everyone at ${branchName || chat.name || "the branch"}`;
  if (chat.kind === "group") return `${chat.members?.length || 0} people`;
  return "Personal chat";
}

export default function Conversation({ chat, user, peopleById, branchName, muted, onBack, onManage }) {
  const companyId = user.companyId;
  const me = user.uid;
  const { messages, loading, hasMore, more } = useMessages(companyId, chat.id);
  const reads = useReads(companyId, chat.id);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef(null);
  const composer = useRef(null);
  const atBottom = useRef(true);
  const firstId = useRef(null);

  const title = chat.title || chatTitle(chat, me, peopleById);
  const Icon = chatIcon(chat.kind);

  // stay at the bottom as messages arrive — unless reading further up
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const olderLoaded = firstId.current && messages[0]?.id !== firstId.current && messages.length > 0;
    if (atBottom.current && !olderLoaded) el.scrollTop = el.scrollHeight;
    firstId.current = messages[0]?.id || null;
  }, [messages]);
  useEffect(() => {
    atBottom.current = true;
    firstId.current = null;
    setReplyTo(null);
    setEditing(null);
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

  // "Seen" under my latest message
  const lastMine = useMemo(() => [...messages].reverse().find((m) => m.byUid === me && !m.deleted), [messages, me]);
  const seenText = (m) => {
    if (!lastMine || m.id !== lastMine.id) return "";
    const who = seenBy(m, reads);
    if (!who.length) return "";
    return chat.kind === "direct" ? "Seen" : `Seen by ${who.length}`;
  };

  const remove = async (m) => {
    if (!(await confirmDialog({ title: "Delete this message?", message: "Everyone will see “Message deleted”.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await deleteMessage(companyId, chat.id, m);
    } catch (e) {
      toast.error("Couldn't delete", { description: e?.code === "permission-denied" ? "Messages can be deleted for 15 minutes after sending." : e?.message });
    }
  };

  const menu = [
    { label: muted ? "Turn notifications on" : "Mute notifications", icon: muted ? Bell : BellOff, onSelect: () => setChatMuted(companyId, me, chat.id, !muted).catch((e) => toast.error("Couldn't save", { description: e?.message })) },
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
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5">
        {onBack && (
          <button type="button" aria-label="Back to chats" onClick={onBack} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg md:hidden">
            <ArrowLeft className="size-5" />
          </button>
        )}
        {Icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Icon className="size-4" />
          </span>
        ) : (
          <Avatar name={title} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg">{title}</p>
          <p className="truncate text-xs text-muted">
            {subtitle(chat, peopleById, branchName)}
            {muted ? " · muted" : ""}
          </p>
        </div>
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
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4"
      >
        {hasMore && (
          <div className="pb-2 text-center">
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
          <p className="py-16 text-center text-sm text-muted">No messages yet — say hello.</p>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
            const sameAsPrev = prev && !newDay && prev.byUid === m.byUid && timeOf(m.createdAt) - timeOf(prev.createdAt) < 5 * 60 * 1000;
            const sameAsNext = next && next.byUid === m.byUid && dayLabel(next.createdAt) === dayLabel(m.createdAt);
            return (
              <div key={m.id} className={cn(!sameAsPrev && "pt-2")}>
                {newDay && (
                  <div className="my-3 flex items-center gap-3 text-[11px] font-semibold text-subtle">
                    <span className="h-px flex-1 bg-line" />
                    {dayLabel(m.createdAt)}
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <Message
                  msg={m}
                  me={me}
                  showName={chat.kind !== "direct" && !sameAsPrev}
                  showAvatar={chat.kind !== "direct" && !sameAsNext}
                  seen={seenText(m)}
                  onReply={(x) => {
                    setEditing(null);
                    setReplyTo(x);
                  }}
                  onEdit={(x) => {
                    setReplyTo(null);
                    setEditing(x);
                  }}
                  onDelete={remove}
                />
              </div>
            );
          })
        )}
      </div>

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
    </div>
  );
}
