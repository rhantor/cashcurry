"use client";
// Chat (roadmap 4.4): the company chat, the branch chats, groups and personal
// chats on the left, the open one on the right (one at a time on phones).
// ?c=<chatId> opens a chat — notifications link there.
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { doc, onSnapshot } from "firebase/firestore";
import { MessageSquarePlus, Search, UserRound, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { Avatar, EmptyState, Input, Menu, Skeleton, cn } from "@/app/components/ui";
import { canMakeGroups, chatTitle, timeOf } from "@/lib/chat/model";
import { useChatPeople, useChats } from "./useChat";
import Conversation, { chatIcon } from "./Conversation";
import { DirectSheet, GroupSheet } from "./ChatSheets";

function ChatRow({ chat, title, active, onOpen, me }) {
  const Icon = chatIcon(chat.kind);
  const last = chat.lastMessage;
  const at = timeOf(last?.at);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", active ? "bg-brand-soft" : "hover:bg-surface-2")}
    >
      {Icon ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon className="size-[18px]" />
        </span>
      ) : (
        <Avatar name={title} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("flex-1 truncate text-sm text-fg", chat.unread ? "font-bold" : "font-semibold")}>{title}</span>
          {at > 0 && <span className="shrink-0 text-[11px] text-subtle">{formatDistanceToNowStrict(at)}</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("flex-1 truncate text-xs", chat.unread ? "font-semibold text-fg" : "text-muted")}>
            {last ? `${last.byUid === me ? "You" : String(last.byName || "").split(" ")[0]}: ${last.text}` : "No messages yet"}
          </span>
          {chat.unread && <span className="size-2.5 shrink-0 rounded-full bg-brand" />}
        </span>
      </span>
    </button>
  );
}

export default function ChatApp({ user, branches = [], className }) {
  const router = useRouter();
  const params = useSearchParams();
  const { chats, ready } = useChats(user, branches);
  const people = useChatPeople(user?.companyId);
  const peopleById = useMemo(() => Object.fromEntries(people.map((p) => [p.uid, p])), [people]);
  const branchNames = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b.name])), [branches]);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(null); // "direct" | "group" | "manage"
  const [mutedChats, setMutedChats] = useState([]);
  const openId = params.get("c");

  // the chats this person muted
  useEffect(() => {
    if (!user?.companyId || !user?.uid) return;
    return onSnapshot(
      doc(db, "companies", user.companyId, "users", user.uid, "prefs", "notifications"),
      (s) => setMutedChats(s.exists() ? s.data().mutedChats || [] : []),
      () => {}
    );
  }, [user?.companyId, user?.uid]);

  const open = (id) => {
    const p = new URLSearchParams(params.toString());
    if (id) p.set("c", id);
    else p.delete("c");
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  const titled = useMemo(() => chats.map((c) => ({ ...c, title: chatTitle(c, user.uid, peopleById, branchNames) })), [chats, user.uid, peopleById, branchNames]);
  const shown = q.trim() ? titled.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase())) : titled;
  const active = titled.find((c) => c.id === openId) || null;

  const newMenu = [
    { label: "Message someone", icon: UserRound, onSelect: () => setSheet("direct") },
    canMakeGroups(user.role) && { label: "New group", icon: Users, onSelect: () => setSheet("group") },
  ].filter(Boolean);

  return (
    <div className={cn("grid min-h-0 overflow-hidden border-line bg-surface md:grid-cols-[20rem_1fr] md:rounded-2xl md:border", className)}>
      {/* the chats */}
      <aside className={cn("flex min-h-0 flex-col border-line md:border-r", active && "hidden md:flex")}>
        <div className="flex items-center gap-2 px-3 pb-2 pt-3">
          <h2 className="flex-1 text-base font-bold text-fg">Chats</h2>
          <Menu
            align="end"
            width={200}
            items={newMenu}
            trigger={(p) => (
              <button {...p} type="button" aria-label="New chat" className="rounded-xl p-2 text-brand hover:bg-brand-soft">
                <MessageSquarePlus className="size-5" />
              </button>
            )}
          />
        </div>
        <div className="relative px-3 pb-2">
          <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-[60%] text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="h-9 pl-9" />
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {!ready && !chats.length ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" rounded="rounded-xl" />)
          ) : (
            shown.map((c) => <ChatRow key={c.id} chat={c} title={c.title} me={user.uid} active={c.id === openId} onOpen={() => open(c.id)} />)
          )}
        </div>
      </aside>

      {/* the open chat */}
      <section className={cn("min-h-0", !active && "hidden md:block")}>
        {active ? (
          <Conversation
            key={active.id}
            chat={active}
            user={user}
            peopleById={peopleById}
            branchName={branchNames[active.branchId]}
            muted={mutedChats.includes(active.id)}
            onBack={() => open(null)}
            onManage={() => setSheet("manage")}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState icon={MessageSquarePlus} title="Pick a chat" description="Or start one: message someone, or (managers) make a group." />
          </div>
        )}
      </section>

      <DirectSheet open={sheet === "direct"} onClose={() => setSheet(null)} user={user} people={people} onOpened={open} />
      {sheet === "group" && <GroupSheet open onClose={() => setSheet(null)} user={user} people={people} onSaved={(id) => id && open(id)} />}
      {sheet === "manage" && active?.kind === "group" && <GroupSheet open onClose={() => setSheet(null)} user={user} people={people} chat={active} onSaved={(id) => open(id)} />}
    </div>
  );
}
