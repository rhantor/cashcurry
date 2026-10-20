"use client";
// Your own notebook (roadmap 4.11): notes and small checklists only you see —
// pinned first, then the latest.
import { useMemo, useState } from "react";
import { NotebookPen, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { Button, EmptyState, Input, Sheet, Skeleton, Textarea, cn, toast } from "@/app/components/ui";
import { confirmDialog } from "@/app/components/ui/notify";
import { NOTE_COLORS } from "@/lib/tasks/model";
import { deleteNote, saveNote, useNotes } from "@/lib/tasks/client";

// colours from the theme's soft tones, so notes read in light and dark
const TINT = { plain: "bg-surface", yellow: "bg-warning-soft", green: "bg-brand-soft", blue: "bg-info-soft", pink: "bg-danger-soft" };
const millis = (t) => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : 0);

function NoteSheet({ note, onClose, companyId, uid }) {
  const [f, setF] = useState(() => ({ title: note?.title || "", body: note?.body || "", items: note?.items || [], pinned: !!note?.pinned, color: note?.color || "plain" }));
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const addItem = () => {
    if (!item.trim()) return;
    set("items", [...f.items, { text: item.trim(), done: false }]);
    setItem("");
  };
  const save = async () => {
    const items = item.trim() ? [...f.items, { text: item.trim(), done: false }] : f.items;
    if (!f.title.trim() && !f.body.trim() && !items.length) return onClose();
    setBusy(true);
    try {
      await saveNote(companyId, uid, { ...f, items }, note?.id);
      onClose();
    } catch (e) {
      toast.error("Couldn't save the note", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await confirmDialog({ title: "Delete this note?", confirmLabel: "Delete", danger: true }))) return;
    await deleteNote(companyId, uid, note.id);
    onClose();
  };
  return (
    <Sheet
      open
      onClose={save}
      title={note ? "Note" : "New note"}
      description="Only you can see your notes."
      footer={
        <>
          {note && <Button variant="ghost" icon={Trash2} onClick={remove} aria-label="Delete note" />}
          <Button onClick={save} loading={busy} className="flex-1">Done</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Title" aria-label="Title" size="lg" />
        <Textarea rows={4} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Write anything…" aria-label="Note" />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Checklist</p>
          {f.items.map((x, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="checkbox" checked={x.done} onChange={() => set("items", f.items.map((y, j) => (j === i ? { ...y, done: !y.done } : y)))} className="size-4 accent-[var(--cc-brand)]" aria-label={x.text} />
              <span className={cn("flex-1 text-sm", x.done ? "text-muted line-through" : "text-fg")}>{x.text}</span>
              <button type="button" aria-label="Remove" onClick={() => set("items", f.items.filter((_, j) => j !== i))} className="rounded p-1 text-subtle hover:bg-surface-2">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); addItem(); }} className="flex gap-2">
            <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add an item" aria-label="New checklist item" />
            <Button type="submit" variant="secondary" icon={Plus} aria-label="Add item" />
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {NOTE_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => set("color", c)} aria-label={`${c} note`} aria-pressed={f.color === c} className={cn("size-7 rounded-full border-2", TINT[c], f.color === c ? "border-brand" : "border-line")} />
          ))}
          <Button size="sm" variant="ghost" icon={f.pinned ? PinOff : Pin} onClick={() => set("pinned", !f.pinned)} className="ml-auto">
            {f.pinned ? "Unpin" : "Pin to top"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export default function NotesTab({ companyId, user }) {
  const { list, loading } = useNotes(companyId, user.uid);
  const [open, setOpen] = useState(null); // a note, or "new"
  const notes = useMemo(() => [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || millis(b.updatedAt) - millis(a.updatedAt)), [list]);
  return (
    <div className="space-y-4">
      <Button icon={Plus} onClick={() => setOpen("new")}>New note</Button>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28" rounded="rounded-2xl" />)}</div>
      ) : !notes.length ? (
        <EmptyState icon={NotebookPen} title="No notes yet" description="Jot down things to remember, or a quick checklist. Only you see them." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => {
            const left = (n.items || []).filter((x) => !x.done).length;
            return (
              <li key={n.id}>
                <button type="button" onClick={() => setOpen(n)} className={cn("flex h-full w-full flex-col gap-1.5 rounded-2xl border border-line p-4 text-left transition hover:-translate-y-px hover:shadow-md", TINT[n.color] || TINT.plain)}>
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{n.title || "Untitled"}</span>
                    {n.pinned && <Pin className="size-3.5 shrink-0 text-muted" aria-label="Pinned" />}
                  </span>
                  {n.body && <span className="line-clamp-3 whitespace-pre-line text-xs text-muted">{n.body}</span>}
                  {n.items?.length > 0 && <span className="text-xs font-medium text-fg">{left ? `${left} of ${n.items.length} to do` : `All ${n.items.length} done`}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && <NoteSheet note={open === "new" ? null : open} onClose={() => setOpen(null)} companyId={user.companyId} uid={user.uid} />}
    </div>
  );
}
