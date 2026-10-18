"use client";
// Report an issue: what's wrong, what kind, urgent or not, photos — and, for
// management, who should fix it and by when.
import { useMemo, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button, DatePicker, Field, Input, Select, Sheet, Switch, Textarea, cn, toast } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import { CATEGORIES, MAX_PHOTOS, canManageIssues } from "@/lib/issues/model";
import { createIssue } from "@/lib/issues/client";
import { roleLabel } from "@/lib/authz/permissions";

export default function NewIssueSheet({ open, onClose, user, branchId, branches = [], people = [], onCreated }) {
  const manage = canManageIssues(user?.role);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("equipment");
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [branch, setBranch] = useState(branchId);
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const picker = useRef(null);
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  const here = branch || branchId;
  const team = people.filter((p) => p.branchId === here || !p.branchId);

  const reset = () => {
    setTitle("");
    setDetails("");
    setUrgent(false);
    setPhotos([]);
    setAssignee("");
    setDue("");
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Say what's wrong");
    setBusy(true);
    try {
      const person = team.find((p) => p.uid === assignee) || null;
      const id = await createIssue(user.companyId, here, user, { title, details, category, priority: urgent ? "urgent" : "normal", photos, assignee: person, dueDate: due || null });
      toast.success("Issue reported", { description: person ? `Given to ${person.name}` : "Management has been told" });
      reset();
      onCreated?.({ id, branchId: here });
      onClose();
    } catch (e) {
      toast.error("Couldn't report the issue", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Report an issue"
      description="Something broken, missing or wrong? Tell the team — with a photo if you can."
      footer={
        <Button onClick={save} loading={busy}>
          Report issue
        </Button>
      }
    >
      <div className="space-y-4">
        {branches.length > 1 && (
          <Field label="Branch">
            {({ id }) => (
              <Select id={id} value={here} onChange={(e) => setBranch(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="What's wrong">{({ id }) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fryer 2 won't heat up" maxLength={120} />}</Field>
        <Field label="Kind">
          {() => (
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip key={c.value} on={category === c.value} onClick={() => setCategory(c.value)}>
                  <span className="mr-1">{c.emoji}</span>
                  {c.label}
                </Chip>
              ))}
            </div>
          )}
        </Field>
        <Field label="More about it (optional)">{({ id }) => <Textarea id={id} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Where, since when, what you've tried…" />}</Field>
        <div className={cn("flex items-center justify-between rounded-xl px-3 py-2.5", urgent ? "bg-danger-soft" : "bg-surface-2")}>
          <div>
            <p className={cn("text-sm font-semibold", urgent ? "text-danger" : "text-fg")}>Urgent</p>
            <p className="text-xs text-muted">Stops work, or isn&apos;t safe — goes to the top</p>
          </div>
          <Switch checked={urgent} onChange={setUrgent} />
        </div>
        <Field label={`Photos (up to ${MAX_PHOTOS})`}>
          {() => (
            <div className="flex flex-wrap gap-2">
              {photos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={previews[i]} alt={f.name} className="size-20 rounded-xl object-cover ring-1 ring-line" />
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setPhotos((p) => p.filter((_, n) => n !== i))} className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-fg text-surface shadow">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" onClick={() => picker.current?.click()} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-[11px] font-semibold text-muted hover:border-brand/50 hover:text-brand">
                  <Camera className="size-5" />
                  Add photo
                </button>
              )}
              <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(e) => {
                  // take the files before clearing the picker (it empties the list)
                  const picked = [...(e.target.files || [])].filter((f) => f.type.startsWith("image/"));
                  e.target.value = "";
                  setPhotos((p) => [...p, ...picked].slice(0, MAX_PHOTOS));
                }} />
            </div>
          )}
        </Field>
        {manage && (
          <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
            <Field label="Give it to (optional)">
              {({ id }) => (
                <Select id={id} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">No one yet</option>
                  {team.map((p) => (
                    <option key={p.uid} value={p.uid}>
                      {p.name} · {roleLabel(p.role)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Fix by (optional)">{() => <DatePicker value={due} onChange={setDue} />}</Field>
          </div>
        )}
      </div>
    </Sheet>
  );
}
