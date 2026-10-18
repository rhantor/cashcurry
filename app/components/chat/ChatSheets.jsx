"use client";
// Starting a chat: message someone (anyone in the company), or — management
// only — make a group and later rename it, change who's in it or delete it.
import { useMemo, useState } from "react";
import { Check, Search, Trash2 } from "lucide-react";
import { Avatar, Button, Field, Input, Sheet, cn, confirmDialog, toast } from "@/app/components/ui";
import { roleLabel } from "@/lib/authz/permissions";
import { createGroup, deleteGroup, forwardMessage, openDirect, saveLabels, updateGroup } from "@/lib/chat/client";
import { LABEL_COLORS, previewOf, removeLabel, toggleLabel } from "@/lib/chat/model";

function PeoplePicker({ people, me, selected, onToggle, single }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return people.filter((p) => p.uid !== me && (!t || `${p.name} ${roleLabel(p.role)}`.toLowerCase().includes(t)));
  }, [people, me, q]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="pl-9" />
      </div>
      <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
        {list.map((p) => {
          const on = selected?.includes(p.uid);
          return (
            <li key={p.uid}>
              <button type="button" onClick={() => onToggle(p)} className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2", on && "bg-brand-soft/50")}>
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{p.name}</span>
                  <span className="text-xs text-muted">{roleLabel(p.role)}</span>
                </span>
                {!single && <span className={cn("flex size-5 items-center justify-center rounded-md border", on ? "border-brand bg-brand text-white" : "border-line")}>{on && <Check className="size-3.5" />}</span>}
              </button>
            </li>
          );
        })}
        {!list.length && <li className="px-3 py-6 text-center text-sm text-muted">No one found</li>}
      </ul>
    </div>
  );
}

/** Message someone personally. */
export function DirectSheet({ open, onClose, user, people, onOpened }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Message someone" description="A personal chat between the two of you.">
      <PeoplePicker
        single
        people={people}
        me={user.uid}
        onToggle={async (p) => {
          if (busy) return;
          setBusy(true);
          try {
            const id = await openDirect(user.companyId, user, p);
            onOpened(id);
            onClose();
          } catch (e) {
            toast.error("Couldn't open the chat", { description: e?.message });
          } finally {
            setBusy(false);
          }
        }}
      />
    </Sheet>
  );
}

/** Make a group, or manage one (chat given). */
export function GroupSheet({ open, onClose, user, people, chat, onSaved }) {
  const editingGroup = !!chat;
  const [name, setName] = useState(chat?.name || "");
  const [members, setMembers] = useState(() => (chat?.members || []).filter((u) => u !== user.uid));
  const [busy, setBusy] = useState(false);
  const toggle = (p) => setMembers((m) => (m.includes(p.uid) ? m.filter((u) => u !== p.uid) : [...m, p.uid]));

  const save = async () => {
    if (!name.trim()) return toast.error("Give the group a name");
    if (!members.length) return toast.error("Add at least one person");
    setBusy(true);
    try {
      if (editingGroup) {
        // whoever manages it stays in it
        await updateGroup(user.companyId, chat.id, { name, members: [...new Set([user.uid, ...members])] });
        onSaved?.(chat.id);
      } else {
        onSaved?.(await createGroup(user.companyId, user, { name, members }));
      }
      onClose();
    } catch (e) {
      toast.error("Couldn't save the group", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: `Delete “${chat.name}”?`, message: "The group and its messages go for everyone.", confirmLabel: "Delete group", danger: true }))) return;
    try {
      await deleteGroup(user.companyId, chat.id);
      onSaved?.(null);
      onClose();
    } catch (e) {
      toast.error("Couldn't delete the group", { description: e?.message });
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editingGroup ? "Manage group" : "New group"}
      description={`${members.length + 1} people, you included`}
      footer={
        <>
          {editingGroup && (
            <Button variant="secondary" icon={Trash2} className="text-danger" onClick={remove}>
              Delete
            </Button>
          )}
          <Button onClick={save} loading={busy}>
            {editingGroup ? "Save" : "Create group"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Group name">{({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitchen team, Managers" maxLength={60} />}</Field>
        <Field label="Who's in it">{() => <PeoplePicker people={people} me={user.uid} selected={members} onToggle={toggle} />}</Field>
      </div>
    </Sheet>
  );
}

/** Forward a message to one or more chats. chats: [{ id, title, kind }] */
export function ForwardSheet({ msg, onClose, user, chats, onSent }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const list = chats.filter((c) => !q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase()));
  const send = async () => {
    setBusy(true);
    try {
      await forwardMessage(user.companyId, msg, picked, user);
      toast.success(picked.length === 1 ? "Forwarded" : `Forwarded to ${picked.length} chats`);
      onSent?.(picked.length === 1 ? picked[0] : null);
      onClose();
    } catch (e) {
      toast.error("Couldn't forward", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={!!msg}
      onClose={onClose}
      title="Forward to…"
      description={msg ? previewOf(msg) : ""}
      footer={
        <Button onClick={send} loading={busy} disabled={!picked.length}>
          Send{picked.length ? ` to ${picked.length}` : ""}
        </Button>
      }
    >
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="pl-9" />
        </div>
        <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {list.map((c) => {
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))} className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2", on && "bg-brand-soft/50")}>
                  <Avatar name={c.title} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{c.title}</span>
                  <span className={cn("flex size-5 items-center justify-center rounded-md border", on ? "border-brand bg-brand text-white" : "border-line")}>{on && <Check className="size-3.5" />}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}

/**
 * Your labels on a chat (only you see them): tick the ones it has, make a
 * new one (name and colour), rename by making anew, delete one everywhere.
 */
export function LabelsSheet({ open, onClose, user, chat, prefs }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[5]);
  const on = prefs.chats?.[chat?.id] || [];
  const save = (next) => saveLabels(user.companyId, user.uid, next).catch((e) => toast.error("Couldn't save", { description: e?.message }));

  const create = () => {
    const n = name.trim();
    if (!n) return;
    if (prefs.labels.some((l) => l.name.toLowerCase() === n.toLowerCase())) return toast.error("You already have that label");
    const label = { id: `l${Date.now().toString(36)}`, name: n.slice(0, 24), color };
    const labels = [...prefs.labels, label];
    save({ labels, chats: chat ? toggleLabel({ ...prefs, labels }, chat.id, label.id) : prefs.chats });
    setName("");
  };
  const remove = async (l) => {
    if (!(await confirmDialog({ title: `Delete “${l.name}”?`, message: "It comes off every chat. Only you had it.", confirmLabel: "Delete", danger: true }))) return;
    save(removeLabel(prefs, l.id));
  };

  return (
    <Sheet open={open} onClose={onClose} title="Labels" description="Sort your chats your way — only you see your labels.">
      <div className="space-y-4">
        {prefs.labels.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {prefs.labels.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2">
                <button type="button" onClick={() => chat && save({ ...prefs, chats: toggleLabel(prefs, chat.id, l.id) })} className="flex flex-1 items-center gap-3 text-left">
                  <span className={cn("flex size-5 items-center justify-center rounded-md border", on.includes(l.id) ? "border-brand bg-brand text-white" : "border-line")}>{on.includes(l.id) && <Check className="size-3.5" />}</span>
                  <span className="size-3 rounded-full" style={{ background: l.color }} />
                  <span className="text-sm font-semibold text-fg">{l.name}</span>
                </button>
                <button type="button" aria-label={`Delete ${l.name}`} onClick={() => remove(l)} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2 rounded-xl bg-surface-2 p-3">
          <p className="text-xs font-semibold text-muted">New label</p>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="e.g. Urgent, Supplier, Kitchen" maxLength={24} />
            <Button onClick={create} disabled={!name.trim()}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {LABEL_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setColor(c)} className={cn("size-6 rounded-full ring-offset-2 ring-offset-surface-2", color === c && "ring-2 ring-fg")} style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
