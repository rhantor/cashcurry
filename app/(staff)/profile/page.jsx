"use client";
// Me — the staff app's profile and settings (docs/STAFF_APP.md, roadmap 4.6).
// Staff change their PIN, photo, contact number, emergency contact and
// notifications themselves; the details they joined with (name, IC, birthday,
// address, bank, job, pay) are shown read-only — their manager changes those.
import { useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Bell, Camera, ChevronRight, Fingerprint, KeyRound, Loader2, LogOut, Phone, ShieldCheck, Smartphone, Trash2, UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import useSession from "@/app/hooks/useSession";
import { Avatar, Skeleton, Switch, cn, confirmDialog, toast } from "@/app/components/ui";
import { signOut } from "@/lib/session";
import { enablePush, pushState } from "@/lib/notifications/push";
import { removeMyPhoto, saveMyPhoto } from "@/lib/staff/self";
import { ROLES } from "@/app/staff-management/lib/constants";
import { useMyStaff } from "../useStaffApp";
import { ContactSheet, PinSheet } from "./sheets";

const MY_KINDS = {
  "requests.mine": { label: "My requests", hint: "Approved, rejected or paid out" },
  "issues.mine": { label: "My issues", hint: "Given to you, resolved, reopened, new comments" },
};

const PUSH_TEXT = {
  on: "On for this phone",
  off: "Off — tap to turn on",
  blocked: "Blocked in this phone's settings",
  homescreen: "Add Cash Curry to your home screen first",
  unavailable: "Not available here",
};

// Only the end of an ID or account number
const masked = (v) => {
  const s = String(v || "").replace(/\s/g, "");
  return s ? `•••• ${s.slice(-4)}` : "";
};
const nice = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

const Card = ({ title, children, className }) => (
  <section className="space-y-2">
    {title && <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-subtle">{title}</h2>}
    <div className={cn("divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface", className)}>{children}</div>
  </section>
);

/** A settings row: icon, words, and a chevron when it opens something. */
function Row({ icon: Icon, label, value, onClick, right, danger }) {
  const inner = (
    <>
      {Icon && (
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl", danger ? "bg-danger/10 text-danger" : "bg-surface-2 text-muted")}>
          <Icon className="size-[18px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium", danger ? "text-danger" : "text-fg")}>{label}</span>
        {value && <span className="block truncate text-xs text-muted">{value}</span>}
      </span>
      {right ?? (onClick && <ChevronRight className="size-4 text-subtle" />)}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2">{inner}</button>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
  );
}

/** A read-only line of what they joined with. */
const Info = ({ label, value }) =>
  value ? (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-fg">{value}</span>
    </div>
  ) : null;

export default function MePage() {
  const { user } = useSession();
  const { staff, priv, loading } = useMyStaff(user);
  const [sheet, setSheet] = useState(null); // "contact" | "pin"
  const [photoBusy, setPhotoBusy] = useState(false);
  const [push, setPush] = useState(null);
  const [muted, setMuted] = useState(null);
  const fileRef = useRef(null);

  const prefsPath = user?.companyId && user?.uid ? `companies/${user.companyId}/users/${user.uid}/prefs/notifications` : null;
  useEffect(() => {
    pushState().then(setPush);
  }, []);
  useEffect(() => {
    if (!prefsPath) return;
    getDoc(doc(db, prefsPath))
      .then((s) => setMuted(s.exists() ? s.data().muted || [] : []))
      .catch(() => setMuted([]));
  }, [prefsPath]);

  const name = staff ? `${staff.firstName || ""} ${staff.lastName || ""}`.trim() : [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "";
  const where = user ? { companyId: user.companyId, branchId: user.branchId } : {};

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !staff) return;
    setPhotoBusy(true);
    try {
      await saveMyPhoto({ ...where, staffId: staff.id, file, oldUrl: staff.photoUrl });
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err.message || "Couldn't save the photo");
    } finally {
      setPhotoBusy(false);
    }
  };

  const dropPhoto = async () => {
    if (!(await confirmDialog({ title: "Remove your photo?", confirmLabel: "Remove", danger: true }))) return;
    setPhotoBusy(true);
    try {
      await removeMyPhoto({ ...where, staffId: staff.id, oldUrl: staff.photoUrl });
    } catch (err) {
      toast.error(err.message || "Couldn't remove the photo");
    } finally {
      setPhotoBusy(false);
    }
  };

  const turnOnPush = async () => {
    if (push !== "off") return;
    setPush(await enablePush({ companyId: user.companyId, uid: user.uid }));
  };

  const toggleKind = async (type, on) => {
    const next = on ? muted.filter((t) => t !== type) : [...new Set([...muted, type])];
    setMuted(next);
    try {
      await setDoc(doc(db, prefsPath), { muted: next }, { merge: true });
    } catch (e) {
      toast.error("Couldn't save", { description: e?.message });
    }
  };

  const logout = async () => {
    if (!(await confirmDialog({ title: "Sign out?", message: "You'll need your number and PIN to come back in.", confirmLabel: "Sign out" }))) return;
    try {
      await signOut();
    } finally {
      window.location.href = "/login";
    }
  };

  if (!user || (loading && !staff)) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-28" rounded="rounded-3xl" />
        <Skeleton className="h-40" rounded="rounded-2xl" />
      </div>
    );
  }

  const role = ROLES.find((r) => r.value === staff?.role)?.label || staff?.role || "Staff";
  const address = priv ? [priv.addressLine1, priv.addressLine2, [priv.postalCode, priv.city].filter(Boolean).join(" "), priv.state].filter(Boolean).join(", ") : "";

  return (
    <div className="space-y-6 p-4 md:p-0">
      {/* Who they are */}
      <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5">
        <div className="relative shrink-0">
          {staff?.photoUrl ? (
            <img src={staff.photoUrl} alt="" className="size-20 rounded-full object-cover" />
          ) : (
            <Avatar name={name} size="lg" className="[&>span]:size-20 [&>span]:text-xl" />
          )}
          {staff && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              aria-label="Change your photo"
              className="absolute -bottom-0.5 -right-0.5 inline-flex size-8 items-center justify-center rounded-full bg-brand text-brand-fg shadow ring-2 ring-surface"
            >
              {photoBusy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{name}</h1>
          <p className="text-sm text-muted">{[role, staff?.department].filter(Boolean).join(" · ")}</p>
          {staff?.photoUrl && (
            <button type="button" onClick={dropPhoto} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-danger">
              <Trash2 className="size-3.5" /> Remove photo
            </button>
          )}
        </div>
      </div>

      {staff && (
        <Card title="Contact">
          <Row icon={Phone} label="Mobile number" value={staff.phone ? `${staff.phone} · you sign in with this` : "Not set"} onClick={() => setSheet("contact")} />
          <Row
            icon={ShieldCheck}
            label="Emergency contact"
            value={priv?.emergencyContactName ? `${priv.emergencyContactName}${priv.emergencyContactPhone ? ` · ${priv.emergencyContactPhone}` : ""}` : "Not set — add someone to call"}
            onClick={() => setSheet("contact")}
          />
        </Card>
      )}

      <Card title="Signing in">
        {staff && <Row icon={KeyRound} label="Change PIN" value="The 6 digits you sign in with" onClick={() => setSheet("pin")} />}
        <Row icon={Fingerprint} label="Fingerprint" value="In the Android app" right={<span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">Soon</span>} />
      </Card>

      <Card title="Notifications">
        <Row
          icon={Smartphone}
          label="On this phone"
          value={PUSH_TEXT[push] || "Checking…"}
          onClick={push === "off" ? turnOnPush : undefined}
          right={push === "on" ? <span className="size-2.5 rounded-full bg-success" /> : undefined}
        />
        {Object.entries(MY_KINDS).map(([type, k]) => (
          <Row
            key={type}
            icon={Bell}
            label={k.label}
            value={k.hint}
            right={<Switch checked={!!muted && !muted.includes(type)} disabled={!muted} onChange={(on) => toggleKind(type, on)} />}
          />
        ))}
        <p className="px-4 py-2.5 text-xs text-subtle">Chats are muted one by one, from the chat itself.</p>
      </Card>

      {staff && (
        <Card title="From when you joined">
          <div className="px-4 pb-1 pt-3">
            <p className="flex items-center gap-2 text-xs text-muted"><UserRound className="size-4" /> Your manager changes these. Something wrong? Tell them in Chat.</p>
          </div>
          <Info label="Name" value={name} />
          <Info label="Job" value={[role, staff.department].filter(Boolean).join(" · ")} />
          <Info label="Started" value={nice(staff.startDate)} />
          <Info label={priv?.icNumber ? "IC number" : "Passport"} value={masked(priv?.icNumber || priv?.passportNumber)} />
          <Info label="Date of birth" value={nice(priv?.dob)} />
          <Info label="Address" value={address} />
          <Info label="Bank" value={[priv?.bankName, masked(priv?.bankAccountNumber)].filter(Boolean).join(" · ")} />
        </Card>
      )}

      <button type="button" onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3.5 text-sm font-semibold text-danger transition hover:bg-danger/5">
        <LogOut className="size-4" /> Sign out
      </button>

      {staff && (
        <>
          <ContactSheet open={sheet === "contact"} onClose={() => setSheet(null)} user={user} staff={staff} priv={priv || {}} />
          <PinSheet open={sheet === "pin"} onClose={() => setSheet(null)} />
        </>
      )}
    </div>
  );
}
