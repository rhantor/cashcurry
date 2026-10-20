"use client";
// Branch settings → Notifications (roadmap 4.3): who at this branch gets each
// kind of notification, and when the daily summary goes out. Chosen by the
// owner, super admin, gm or the branch admin (firestore.rules: settings/
// notifications); until a kind is chosen, its default roles get it
// (lib/notify/model.js). Saved on its own, apart from the rest of the form.
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { Check, RotateCcw, Save } from "lucide-react";
import { db } from "@/lib/firebase";
import { NOTIFY_TYPES, DEFAULT_DAILY_AT, branchPeople, mayGet, recipientsFor } from "@/lib/notify/model";
import { DEFAULT_MORNING_AT } from "@/lib/tasks/model";
import { personName } from "@/lib/people";
import { roleLabel } from "@/lib/authz/permissions";
import { Avatar, Badge, Button, Card, Field, Select, Skeleton, cn, toast } from "@/app/components/ui";

const HOURS = Array.from({ length: 24 }, (_, i) => `${String((i + 6) % 24).padStart(2, "0")}:00`);
const hourLabel = (h) => {
  const n = Number(h.slice(0, 2));
  return `${n % 12 || 12}:00 ${n < 12 ? "am" : "pm"}`;
};

/** Company roles and this branch's office users, once each. */
async function loadPeople(companyId, branchId) {
  const lists = await Promise.all(
    [
      ["companies", companyId, "users"],
      ["companies", companyId, "branches", branchId, "admins"],
      ["companies", companyId, "branches", branchId, "users"],
    ].map((p) => getDocs(collection(db, ...p)).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []))
  );
  const byId = new Map();
  lists.forEach((list, i) =>
    list.forEach((u) => {
      const uid = u.uid || u.id;
      if (!byId.has(uid)) byId.set(uid, { uid, role: u.role || (i === 1 ? "branchAdmin" : ""), branchId: i === 0 ? u.branchId || null : branchId, name: personName(u) || u.userName || u.email || "—" });
    })
  );
  return branchPeople([...byId.values()], branchId).sort((a, b) => a.name.localeCompare(b.name));
}

export default function NotificationsSection({ companyId, branchId }) {
  const [people, setPeople] = useState(null);
  const [config, setConfig] = useState(null);
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId || !branchId) return;
    setPeople(null);
    setConfig(null);
    Promise.all([loadPeople(companyId, branchId), getDoc(doc(db, "companies", companyId, "branches", branchId, "settings", "notifications"))])
      .then(([p, snap]) => {
        const c = snap.exists() ? snap.data() : {};
        const clean = { recipients: c.recipients || {}, dailyAt: c.dailyAt || DEFAULT_DAILY_AT, tasksMorningAt: c.tasksMorningAt || DEFAULT_MORNING_AT, tasksEveningAt: c.tasksEveningAt || "" };
        setPeople(p);
        setConfig(clean);
        setSaved(JSON.stringify(clean));
      })
      .catch((e) => toast.error("Couldn't load notification settings", { description: e?.message }));
  }, [companyId, branchId]);

  const dirty = config && JSON.stringify(config) !== saved;
  const chosen = useMemo(
    () => (config && people ? Object.fromEntries(Object.keys(NOTIFY_TYPES).map((t) => [t, recipientsFor(t, { config, people })])) : {}),
    [config, people]
  );

  if (!config || !people) return <Skeleton className="h-96" rounded="rounded-2xl" />;

  const toggle = (type, uid) =>
    setConfig((c) => {
      const now = chosen[type];
      const next = now.includes(uid) ? now.filter((u) => u !== uid) : [...now, uid];
      return { ...c, recipients: { ...c.recipients, [type]: next } };
    });
  const reset = (type) =>
    setConfig((c) => {
      const { [type]: _gone, ...rest } = c.recipients;
      return { ...c, recipients: rest };
    });

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "companies", companyId, "branches", branchId, "settings", "notifications"), { ...config, updatedAt: serverTimestamp() });
      setSaved(JSON.stringify(config));
      toast.success("Notification settings saved");
    } catch (e) {
      toast.error("Couldn't save", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(NOTIFY_TYPES).map(([type, t]) => {
        const custom = Array.isArray(config.recipients[type]);
        return (
          <Card key={type} className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  {t.label}
                  {!custom && <Badge tone="neutral" className="px-2 py-px text-[10px]">Default</Badge>}
                </h3>
                <p className="text-xs text-muted">{t.hint}</p>
              </div>
              {custom && (
                <button type="button" onClick={() => reset(type)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-fg">
                  <RotateCcw className="size-3.5" /> Back to default
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {people.filter((p) => mayGet(type, p.role)).map((p) => {
                const on = chosen[type].includes(p.uid);
                return (
                  <button
                    key={p.uid}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(type, p.uid)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors",
                      on ? "border-brand/40 bg-brand-soft text-fg" : "border-line bg-surface text-muted hover:border-brand/30"
                    )}
                  >
                    <Avatar name={p.name} size="sm" />
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-subtle">{roleLabel(p.role)}</span>
                    {on && <Check className="size-3.5 text-brand" />}
                  </button>
                );
              })}
            </div>
            {type.startsWith("daily.") && !chosen[type].length && <p className="mt-2 text-xs text-subtle">No one gets this summary.</p>}
          </Card>
        );
      })}

      <Card className="p-4 sm:p-5">
        <Field label="Daily summary goes out at" hint="On the branch's clock — for the business day before">
          {({ id }) => (
            <Select id={id} value={config.dailyAt} onChange={(e) => setConfig((c) => ({ ...c, dailyAt: e.target.value }))} className="max-w-48">
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>

      {/* task reminders (4.11): whoever has tasks gets them; each person can turn them off from the bell */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-fg">Task reminders</h3>
          <p className="text-xs text-muted">Everyone with tasks: in the morning what is on today, in the evening what is still left. Anyone can turn them off for themselves from the bell.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Morning reminder at">
            {({ id }) => (
              <Select id={id} value={config.tasksMorningAt} onChange={(e) => setConfig((c) => ({ ...c, tasksMorningAt: e.target.value }))}>
                {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Evening reminder at" hint="Only to those with something left">
            {({ id }) => (
              <Select id={id} value={config.tasksEveningAt} onChange={(e) => setConfig((c) => ({ ...c, tasksEveningAt: e.target.value }))}>
                <option value="">2 hours before the day ends</option>
                {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>
          Save notification settings
        </Button>
      </div>
    </div>
  );
}
