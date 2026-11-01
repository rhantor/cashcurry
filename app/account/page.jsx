"use client";
// My profile (owner, 1 Nov) — everyone in the office changes their own: the
// name the app and vouchers show, a photo, a phone number, their password,
// their signature and which notifications they get. Role, branch, username
// and email are shown only: an admin changes those (they are how you sign in).
// Staff have their own in the staff app (app/(staff)/profile).
import { useEffect, useRef, useState } from "react";
import { Bell, Camera, ChevronRight, KeyRound, Mail, PenLine, Phone, Smartphone, Trash2, UserRound } from "lucide-react";
import { skipToken } from "@reduxjs/toolkit/query";
import useSession from "@/app/hooks/useSession";
import { Avatar, Button, Field, Input, Sheet, Skeleton, Switch, cn, confirmDialog, toast } from "@/app/components/ui";
import MySignatureSheet from "@/app/components/account/MySignatureSheet";
import { changeMyPassword, photoFrom, saveMyName, saveMyPhone, saveMyPhoto, useMuted } from "@/lib/account/client";
import { useSignature } from "@/lib/signatures/client";
import { NOTIFY_TYPES, mayGet } from "@/lib/notify/model";
import { enablePush, pushState } from "@/lib/notify/push";
import { roleLabel } from "@/lib/authz/permissions";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { personName } from "@/lib/people";

// about you yourself, whatever your role
const MY_KINDS = {
  "requests.mine": { label: "My requests", hint: "Yours approved, rejected or paid out" },
  "issues.mine": { label: "My issues", hint: "Given to you, resolved, reopened, new comments" },
};

const PUSH_TEXT = {
  on: "On for this device",
  off: "Off — tap to turn on",
  blocked: "Blocked in this browser's settings",
  homescreen: "Add Cash Curry to your home screen first",
  unavailable: "Not available here",
};

const Card = ({ title, children }) => (
  <section className="space-y-2">
    {title && <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-subtle">{title}</h2>}
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
  </section>
);

/** A settings row: icon, words, and a chevron when it opens something. */
function Row({ icon: Icon, label, value, onClick, right }) {
  const inner = (
    <>
      {Icon && (
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
          <Icon className="size-[18px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{label}</span>
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

function NameSheet({ open, onClose, user }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const parts = personName(user).split(" ");
    setFirst(user?.firstName || parts[0] || "");
    setLast(user?.lastName ?? parts.slice(1).join(" "));
  }, [open, user]);
  const save = async () => {
    setBusy(true);
    try {
      await saveMyName(user, first, last);
      toast.success("Name saved");
      onClose();
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Your name" description="As the app, chats and vouchers show it." footer={<Button onClick={save} loading={busy} disabled={!first.trim()}>Save</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name">{({ id }) => <Input id={id} value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" />}</Field>
        <Field label="Last name">{({ id }) => <Input id={id} value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />}</Field>
      </div>
    </Sheet>
  );
}

function PhoneSheet({ open, onClose, user }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setPhone(user?.phone || "");
  }, [open, user]);
  const save = async () => {
    setBusy(true);
    try {
      await saveMyPhone(user, phone);
      toast.success("Phone number saved");
      onClose();
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Your phone number" description="So people at work can reach you." footer={<Button onClick={save} loading={busy}>Save</Button>}>
      <Field label="Phone number">{({ id }) => <Input id={id} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +60 12 345 6789" autoComplete="tel" />}</Field>
    </Sheet>
  );
}

function PasswordSheet({ open, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) [setCurrent, setNext, setAgain].forEach((f) => f(""));
  }, [open]);
  const mismatch = again && next !== again;
  const save = async () => {
    setBusy(true);
    try {
      await changeMyPassword(current, next);
      toast.success("Password changed", { description: "Use the new one next time you sign in." });
      onClose();
    } catch (e) {
      toast.error("Couldn't change it", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change your password"
      description="Your current password first, then the new one twice."
      footer={<Button onClick={save} loading={busy} disabled={!current || next.length < 8 || next !== again}>Change password</Button>}
    >
      <div className="space-y-3">
        <Field label="Current password">{({ id }) => <Input id={id} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}</Field>
        <Field label="New password" hint="8 or more characters">{({ id }) => <Input id={id} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}</Field>
        <Field label="New password again" error={mismatch ? "The two don't match" : undefined}>
          {({ id, invalid }) => <Input id={id} type="password" invalid={invalid} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />}
        </Field>
      </div>
    </Sheet>
  );
}

export default function AccountPage() {
  const { user, companyId } = useSession();
  const me = user ? { ...user, companyId: user.companyId || companyId } : null;
  const { data: branch } = useGetSingleBranchQuery(me?.companyId && me?.branchId ? { companyId: me.companyId, branchId: me.branchId } : skipToken);
  const signature = useSignature(me?.companyId, me?.uid);
  const [muted, setOn] = useMuted(me?.companyId, me?.uid);
  const [sheet, setSheet] = useState(null); // "name" | "phone" | "password" | "signature"
  const [photoBusy, setPhotoBusy] = useState(false);
  const [push, setPush] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    pushState().then(setPush).catch(() => setPush("unavailable"));
  }, []);

  if (!me) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Skeleton className="h-28" rounded="rounded-3xl" />
        <Skeleton className="h-40" rounded="rounded-2xl" />
      </div>
    );
  }

  const name = personName(me);
  const kinds = [
    ...Object.entries(NOTIFY_TYPES).filter(([type]) => mayGet(type, me.role)),
    ...Object.entries(MY_KINDS),
  ];

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      await saveMyPhoto(me, await photoFrom(file));
      toast.success("Photo saved");
    } catch (err) {
      toast.error("Couldn't save the photo", { description: err.message });
    } finally {
      setPhotoBusy(false);
    }
  };
  const dropPhoto = async () => {
    if (!(await confirmDialog({ title: "Remove your photo?", confirmLabel: "Remove", danger: true }))) return;
    setPhotoBusy(true);
    try {
      await saveMyPhoto(me, null);
    } catch (err) {
      toast.error("Couldn't remove the photo", { description: err.message });
    } finally {
      setPhotoBusy(false);
    }
  };
  const turnOnPush = async () => {
    if (push !== "off") return;
    setPush(await enablePush({ companyId: me.companyId, uid: me.uid }));
  };
  const toggleKind = async (type, on) => {
    try {
      await setOn(type, on);
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      <h1 className="text-xl font-semibold text-fg">My profile</h1>

      {/* who you are */}
      <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5">
        <div className="relative shrink-0">
          <Avatar name={name} src={me.photo || undefined} size="lg" className="[&>img]:size-20 [&>span]:size-20 [&>span]:text-xl" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            aria-label="Change your photo"
            className="absolute -bottom-1 -right-1 inline-flex size-8 items-center justify-center rounded-full border-2 border-surface bg-brand text-brand-fg shadow-sm"
          >
            <Camera className="size-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-fg">{name}</p>
          <p className="truncate text-sm text-muted">{[roleLabel(me.role), branch?.name].filter(Boolean).join(" · ")}</p>
          {me.photo && (
            <button type="button" onClick={dropPhoto} disabled={photoBusy} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger">
              <Trash2 className="size-3.5" /> Remove photo
            </button>
          )}
        </div>
      </div>

      <Card title="About you">
        <Row icon={UserRound} label="Name" value={name} onClick={() => setSheet("name")} />
        <Row icon={Phone} label="Phone number" value={me.phone || "Not set"} onClick={() => setSheet("phone")} />
        <Row icon={Mail} label="Username and email" value={[me.username || me.userName, me.email].filter(Boolean).join(" · ") + " — an admin changes these"} />
      </Card>

      <Card title="Signing in">
        <Row icon={KeyRound} label="Change password" value="Your current one first" onClick={() => setSheet("password")} />
      </Card>

      <Card title="Signature">
        <Row
          icon={PenLine}
          label="My signature"
          value={signature ? "On the vouchers you prepare or approve" : "Not added — your name goes on in handwriting style"}
          onClick={() => setSheet("signature")}
          right={
            signature ? (
              <span className="flex h-10 w-28 items-center justify-center rounded-lg border border-line bg-white px-1">
                <img src={signature} alt="Your signature" className="max-h-full max-w-full object-contain" />
              </span>
            ) : undefined
          }
        />
      </Card>

      <Card title="Notifications">
        <Row icon={Smartphone} label="On this device" value={PUSH_TEXT[push] || "Checking…"} onClick={push === "off" ? turnOnPush : undefined} right={push === "on" ? <Bell className="size-4 text-success" /> : undefined} />
        {muted === null ? (
          <div className="p-4"><Skeleton className="h-10" /></div>
        ) : (
          kinds.map(([type, k]) => (
            <Row key={type} label={k.label} value={k.hint} right={<Switch checked={!muted.includes(type)} onChange={(on) => toggleKind(type, on)} />} />
          ))
        )}
      </Card>
      <p className={cn("px-1 text-xs text-subtle")}>Turning one off is just for you. Who gets each kind at a branch is set in Branch Settings → Notifications.</p>

      <NameSheet open={sheet === "name"} onClose={() => setSheet(null)} user={me} />
      <PhoneSheet open={sheet === "phone"} onClose={() => setSheet(null)} user={me} />
      <PasswordSheet open={sheet === "password"} onClose={() => setSheet(null)} />
      <MySignatureSheet open={sheet === "signature"} onClose={() => setSheet(null)} user={me} />
    </div>
  );
}
