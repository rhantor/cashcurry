"use client";
// Settings → Cost categories (roadmap 4.9): the groups and categories every
// branch picks from when entering a cost. Owner, super admin and GM keep them.
// Saved costs keep the names they were saved with, so renaming, moving or
// hiding a category only changes what new costs can pick.
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, ReceiptText, RotateCcw, Store, Trash2 } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import { Badge, Button, Card, Input, Skeleton, cn, confirmDialog, toast } from "@/app/components/ui";
import { DEFAULT_GROUPS, KINDS, NEEDS, checkGroups, newId } from "@/lib/costs/categories";
import { saveCostCategories, useCostCategories } from "@/lib/costs/client";

const NEED_ICON = { paidTo: Store, billFor: ReceiptText };
const copy = (groups) => JSON.parse(JSON.stringify(groups));

export default function CostCategories() {
  const { user, companyId } = useSession();
  const { groups, saved, loading } = useCostCategories(companyId);
  const [draft, setDraft] = useState(null);
  const [adding, setAdding] = useState({}); // groupId → new category name
  const [newGroup, setNewGroup] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !draft) setDraft(copy(groups));
  }, [loading, groups, draft]);

  const dirty = useMemo(() => draft && JSON.stringify(draft) !== JSON.stringify(groups), [draft, groups]);
  const problems = useMemo(() => (draft ? checkGroups(draft) : []), [draft]);
  const allIds = useMemo(() => (draft || []).flatMap((g) => [g.id, ...g.categories.map((c) => c.id)]), [draft]);

  if (loading || !draft) return <Skeleton className="h-64" rounded="rounded-2xl" />;

  const edit = (fn) => setDraft((d) => { const next = copy(d); fn(next); return next; });
  const setGroup = (gi, patch) => edit((d) => Object.assign(d[gi], patch));
  const setCat = (gi, ci, patch) => edit((d) => Object.assign(d[gi].categories[ci], patch));
  const move = (gi, ci, by) => edit((d) => {
    const list = d[gi].categories;
    const j = ci + by;
    if (j < 0 || j >= list.length) return;
    [list[ci], list[j]] = [list[j], list[ci]];
  });
  const toggleNeed = (gi, ci, need) => edit((d) => {
    const c = d[gi].categories[ci];
    c.needs = c.needs.includes(need) ? c.needs.filter((n) => n !== need) : [...c.needs, need];
  });
  const addCategory = (gi) => {
    const name = (adding[draft[gi].id] || "").trim();
    if (!name) return;
    edit((d) => d[gi].categories.push({ id: newId(name, allIds), name, needs: [] }));
    setAdding((a) => ({ ...a, [draft[gi].id]: "" }));
  };
  const addGroup = () => {
    const name = newGroup.trim();
    if (!name) return;
    edit((d) => d.splice(d.length - 1, 0, { id: newId(name, allIds), name, kind: "expense", categories: [] }));
    setNewGroup("");
  };
  // A category no cost was saved with yet can go; anything else is hidden instead.
  const removeOrHide = async (gi, ci) => {
    const c = draft[gi].categories[ci];
    const isNew = !groups.some((g) => g.categories.some((x) => x.id === c.id));
    if (isNew) return edit((d) => d[gi].categories.splice(ci, 1));
    setCat(gi, ci, { hidden: !c.hidden });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveCostCategories(companyId, draft, user);
      toast.success("Cost categories saved", { description: "New costs use them from now on." });
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!(await confirmDialog({ title: "Start again from the standard list?", message: "Your changes here are replaced by Cash Curry's standard groups. Saved costs are not touched." }))) return;
    setDraft(copy(DEFAULT_GROUPS.map((g) => ({ ...g, categories: g.categories.map((c) => ({ needs: [], ...c })) }))));
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-muted">
          Every branch picks from these when entering a cost. Money that leaves but isn&apos;t a cost (owner drawings, deposits, loan repayments…) goes in a
          <b className="text-fg"> Not a cost </b>group — it still comes out of the till or bank, but stays out of profit.
          {!saved && <span className="mt-1 block text-xs text-subtle">You&apos;re seeing Cash Curry&apos;s standard list — save to make it yours.</span>}
        </p>
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={reset}>Standard list</Button>
          <Button size="sm" onClick={save} loading={saving} disabled={(!dirty && !!saved) || problems.length > 0}>Save</Button>
        </div>
        {problems.length > 0 && <p className="w-full text-xs font-medium text-danger">{problems[0]}</p>}
      </Card>

      {draft.map((g, gi) => (
        <Card key={g.id} className={cn("overflow-hidden", g.kind === "notCost" && "border-dashed")}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/50 px-4 py-3">
            <Input value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} className="h-9 max-w-xs flex-1 font-semibold" aria-label="Group name" />
            <div className="inline-flex rounded-xl bg-surface p-0.5 ring-1 ring-line">
              {Object.entries(KINDS).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setGroup(gi, { kind: k })}
                  className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold transition", g.kind === k ? (k === "notCost" ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand") : "text-muted")}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-subtle">{g.categories.filter((c) => !c.hidden).length} in use</span>
          </div>
          <ul className="divide-y divide-line">
            {g.categories.map((c, ci) => (
              <li key={c.id} className={cn("flex flex-wrap items-center gap-2 px-4 py-2", c.hidden && "opacity-55")}>
                <Input value={c.name} onChange={(e) => setCat(gi, ci, { name: e.target.value })} className="h-9 min-w-40 flex-1" aria-label="Category name" />
                {Object.entries(NEEDS).map(([need, label]) => {
                  const Icon = NEED_ICON[need];
                  const on = c.needs.includes(need);
                  return (
                    <button
                      key={need}
                      type="button"
                      aria-label={label}
                      aria-pressed={on}
                      onClick={() => toggleNeed(gi, ci, need)}
                      title={on ? `Asks: ${label}` : `Ask: ${label}`}
                      className={cn("inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition", on ? "bg-info/10 text-info" : "text-subtle hover:bg-surface-2")}
                    >
                      <Icon className="size-3.5" /> <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
                <div className="flex items-center">
                  <button type="button" aria-label="Move up" onClick={() => move(gi, ci, -1)} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"><ArrowUp className="size-4" /></button>
                  <button type="button" aria-label="Move down" onClick={() => move(gi, ci, 1)} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"><ArrowDown className="size-4" /></button>
                  {groups.some((x) => x.categories.some((y) => y.id === c.id)) ? (
                    <button type="button" aria-label={c.hidden ? "Show again" : "Hide"} title={c.hidden ? "Hidden — tap to use it again" : "Hide (saved costs keep it)"} onClick={() => removeOrHide(gi, ci)} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg">
                      {c.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  ) : (
                    <button type="button" aria-label="Remove" onClick={() => removeOrHide(gi, ci)} className="rounded-lg p-1.5 text-subtle hover:bg-danger/10 hover:text-danger"><Trash2 className="size-4" /></button>
                  )}
                </div>
                {c.hidden && <Badge tone="neutral">Hidden</Badge>}
              </li>
            ))}
            <li className="flex gap-2 px-4 py-2.5">
              <Input
                value={adding[g.id] || ""}
                onChange={(e) => setAdding((a) => ({ ...a, [g.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addCategory(gi)}
                placeholder={`Add a category to ${g.name || "this group"}`}
                className="h-9 flex-1"
              />
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => addCategory(gi)}>Add</Button>
            </li>
          </ul>
        </Card>
      ))}

      <Card className="flex gap-2 p-4">
        <Input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGroup()} placeholder="New group, e.g. Catering" className="h-10 flex-1" />
        <Button variant="secondary" icon={Plus} onClick={addGroup}>Add group</Button>
      </Card>
    </div>
  );
}
