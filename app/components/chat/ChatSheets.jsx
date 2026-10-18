"use client";
// Starting a chat: message someone (anyone in the company), or — management
// only — make a group and later rename it, change who's in it or delete it.
import { useMemo, useState } from "react";
import { Check, Search, Trash2 } from "lucide-react";
import { Avatar, Button, Field, Input, Sheet, cn, confirmDialog, toast } from "@/app/components/ui";
import { roleLabel } from "@/lib/authz/permissions";
import { createGroup, deleteGroup, openDirect, updateGroup } from "@/lib/chat/client";

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
