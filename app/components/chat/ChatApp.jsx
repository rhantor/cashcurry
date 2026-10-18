"use client";
// Chat (roadmap 4.4): the company chat, the branch chats, groups and personal
// chats on the left (filter: all / unread / groups / people), the open one on
// the right — one at a time on phones. ?c=<chatId> opens a chat;
// notifications link there.
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, isToday, isYesterday } from "date-fns";
import { doc, onSnapshot } from "firebase/firestore";
import { BellOff, MessageSquarePlus, MessagesSquare, Search, UserRound, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { Avatar, Input, Menu, Skeleton, cn } from "@/app/components/ui";
import { canMakeGroups, chatTitle, labelsOf, timeOf } from "@/lib/chat/model";
import { useChatLabels, useChatPeople, useChats } from "./useChat";
import Conversation, { chatIcon } from "./Conversation";
import { DirectSheet, ForwardSheet, GroupSheet, LabelsSheet } from "./ChatSheets";

const when = (t) => {
  if (!t) return "";
  const d = new Date(t);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, Date.now() - t < 6 * 86400000 ? "EEE" : "d MMM");
};

const FILTERS = [
  ["all", "All"],
  ["unread", "Unread"],
  ["groups", "Groups"],
  ["people", "People"],
];

function ChatRow({ chat, active, muted, labels = [], onOpen, me }) {
  const Icon = chatIcon(chat.kind);
  const last = chat.lastMessage;
  const who = last ? (last.byUid === me ? "You" : chat.kind === "direct" ? "" : String(last.byName || "").split(" ")[0]) : "";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors", active ? "bg-brand-soft" : "hover:bg-surface-2")}
    >
      {Icon ? (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand/70 text-white shadow-sm">
          <Icon className="size-5" />
        </span>
      ) : (
        <Avatar name={chat.title} size="lg" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("flex-1 truncate text-sm text-fg", chat.unread ? "font-bold" : "font-semibold")}>{chat.title}</span>
          <span className={cn("shrink-0 text-[11px]", chat.unread ? "font-semibold text-brand" : "text-subtle")}>{when(timeOf(last?.at))}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn("flex-1 truncate text-xs", chat.unread ? "font-medium text-fg" : "text-muted")}>
            {last ? `${who ? `${who}: ` : ""}${last.text}` : "No messages yet"}
          </span>
          {muted && <BellOff className="size-3.5 shrink-0 text-subtle" />}
          {chat.unread && <span className="size-2.5 shrink-0 rounded-full bg-brand" />}
        </span>
        {labels.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {labels.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold" style={{ background: `${l.color}1f`, color: l.color }}>
                <span className="size-1.5 rounded-full" style={{ background: l.color }} />
                {l.name}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

export default function ChatApp({ user, branches = [], allBranches, className }) {
  const router = useRouter();
  const params = useSearchParams();
  const { chats, ready } = useChats(user, branches);
  const people = useChatPeople(user?.companyId);
  const peopleById = useMemo(() => Object.fromEntries(people.map((p) => [p.uid, p])), [people]);
  // names from every branch the company has, so a chat is never shown as just "Branch"
  const branchNames = useMemo(() => Object.fromEntries((allBranches || branches).map((b) => [b.id, b.name])), [allBranches, branches]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sheet, setSheet] = useState(null); // "direct" | "group" | "manage"
  const [forwarding, setForwarding] = useState(null);
  const [mutedChats, setMutedChats] = useState([]);
  const labelPrefs = useChatLabels(user?.companyId, user?.uid);
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
  const unreadCount = titled.filter((c) => c.unread).length;
  const shown = titled.filter(
    (c) =>
      (!q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase())) &&
      (filter === "all" ||
        (filter === "unread" && c.unread) ||
        (filter === "groups" && c.kind !== "direct") ||
        (filter === "people" && c.kind === "direct") ||
        (labelPrefs.chats?.[c.id] || []).includes(filter))
  );
  const active = titled.find((c) => c.id === openId) || null;

  const newMenu = [
    { label: "Message someone", icon: UserRound, onSelect: () => setSheet("direct") },
    canMakeGroups(user.role) && { label: "New group", icon: Users, onSelect: () => setSheet("group") },
  ].filter(Boolean);

  return (
    <div className={cn("grid min-h-0 overflow-hidden bg-surface md:grid-cols-[22rem_1fr]", className)}>
      {/* the chats */}
      <aside className={cn("flex min-h-0 flex-col border-line md:border-r", active && "hidden md:flex")}>
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <h2 className="flex-1 text-xl font-bold tracking-tight text-fg">Chats</h2>
          <Menu
            align="end"
            width={200}
            items={newMenu}
            trigger={(p) => (
              <button {...p} type="button" aria-label="New chat" className="flex size-9 items-center justify-center rounded-full bg-brand text-white shadow-sm transition-transform hover:scale-105">
                <MessageSquarePlus className="size-[18px]" />
              </button>
            )}
          />
        </div>
        <div className="relative px-4 pb-2">
          <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-[60%] text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-10 rounded-full pl-9" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {[...FILTERS, ...labelPrefs.labels.map((l) => [l.id, l.name, l.color])].map(([v, label, color]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors", filter === v ? "bg-fg text-surface" : "bg-surface-2 text-muted hover:text-fg")}
            >
              {color && <span className="mr-1 inline-block size-2 rounded-full" style={{ background: color }} />}
              {label}
              {v === "unread" && unreadCount > 0 && <span className="ml-1 tabular-nums">{unreadCount}</span>}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {!ready && !chats.length ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="mx-2 my-1 h-14" rounded="rounded-2xl" />)
          ) : shown.length ? (
            shown.map((c) => <ChatRow key={c.id} chat={c} me={user.uid} muted={mutedChats.includes(c.id)} labels={labelsOf(c.id, labelPrefs)} active={c.id === openId} onOpen={() => open(c.id)} />)
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted">{filter === "unread" ? "You're all caught up." : "No chats here."}</p>
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
            onForward={setForwarding}
            onLabels={() => setSheet("labels")}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
            <span className="flex size-16 items-center justify-center rounded-3xl bg-brand-soft text-brand">
              <MessagesSquare className="size-8" />
            </span>
            <p className="text-base font-bold text-fg">Your messages</p>
            <p className="max-w-xs text-sm text-muted">Pick a chat on the left, or start one — message anyone in the company{canMakeGroups(user.role) ? ", or make a group" : ""}.</p>
          </div>
        )}
      </section>

      <DirectSheet open={sheet === "direct"} onClose={() => setSheet(null)} user={user} people={people} onOpened={open} />
      {sheet === "group" && <GroupSheet open onClose={() => setSheet(null)} user={user} people={people} onSaved={(id) => id && open(id)} />}
      {sheet === "manage" && active?.kind === "group" && <GroupSheet open onClose={() => setSheet(null)} user={user} people={people} chat={active} onSaved={(id) => open(id)} />}
      <LabelsSheet open={sheet === "labels"} onClose={() => setSheet(null)} user={user} chat={active} prefs={labelPrefs} />
      {forwarding && <ForwardSheet msg={forwarding} onClose={() => setForwarding(null)} user={user} chats={titled} people={people} onSent={(id) => id && open(id)} />}
    </div>
  );
}
