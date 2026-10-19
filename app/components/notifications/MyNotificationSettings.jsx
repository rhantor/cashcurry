"use client";
// Your own notification choices (roadmap 4.3): mute a kind for yourself.
// Who gets each kind at a branch is chosen in Branch settings → Notifications;
// this only turns off what you would otherwise get. Saved at
// companies/{c}/users/{uid}/prefs/notifications { muted: [types] }.
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import useSession from "@/app/hooks/useSession";
import { NOTIFY_TYPES, mayGet } from "@/lib/notify/model";
import { Switch, toast } from "@/app/components/ui";

const MINE = {
  "requests.mine": { label: "My own requests", hint: "When something you asked for is approved, rejected or paid out" },
  "issues.mine": { label: "My issues", hint: "Issues you reported or were given: assigned, resolved, reopened, new comments" },
};

export default function MyNotificationSettings({ onBack }) {
  const { user } = useSession();
  const [muted, setMuted] = useState(null);
  const ref = user?.companyId && user?.uid ? doc(db, "companies", user.companyId, "users", user.uid, "prefs", "notifications") : null;
  const path = ref?.path;

  useEffect(() => {
    if (!path) return;
    getDoc(doc(db, path))
      .then((s) => setMuted(s.exists() ? s.data().muted || [] : []))
      .catch(() => setMuted([]));
  }, [path]);

  const staff = user?.role === "staff";
  // only the kinds this person can get at all (lib/notify/model.js canGet)
  const kinds = staff ? MINE : { ...MINE, ...Object.fromEntries(Object.entries(NOTIFY_TYPES).filter(([t]) => mayGet(t, user?.role))) };

  const toggle = async (type, on) => {
    const next = on ? muted.filter((t) => t !== type) : [...new Set([...muted, type])];
    setMuted(next);
    try {
      await setDoc(ref, { muted: next }, { merge: true });
    } catch (e) {
      toast.error("Couldn't save", { description: e?.message });
    }
  };

  return (
    <div className="max-h-[min(70vh,560px)] overflow-y-auto pb-3">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <button type="button" aria-label="Back" onClick={onBack} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="size-4" />
        </button>
        <p className="text-sm font-bold text-fg">What I get</p>
      </div>
      <p className="px-4 pb-2 text-xs text-muted">
        {staff ? "Turn off what you don't want." : "Who gets each kind at a branch is set in Branch settings → Notifications. Here you can turn off what you'd rather not get."}
      </p>
      <ul className="divide-y divide-line">
        {Object.entries(kinds).map(([type, t]) => (
          <li key={type} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{t.label}</p>
              <p className="text-xs text-muted">{t.hint}</p>
            </div>
            <Switch checked={muted ? !muted.includes(type) : true} disabled={!muted} onChange={(on) => toggle(type, on)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
