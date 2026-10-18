"use client";
// The staff app's settings sheets: contact details and the PIN.
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, Field, Input, Sheet, toast } from "@/app/components/ui";
import { RULES } from "@/app/staff-management/lib/validation";
import { changeMyPin, pinChangeError, saveMyContact, weakPin } from "@/lib/staff/self";

/** Their number (also how they sign in) and who to call in an emergency. */
export function ContactSheet({ open, onClose, user, staff, priv }) {
  const [form, setForm] = useState({ phone: "", emergencyContactName: "", emergencyContactPhone: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ phone: staff?.phone || "", emergencyContactName: priv?.emergencyContactName || "", emergencyContactPhone: priv?.emergencyContactPhone || "" });
    setError(null);
  }, [open, staff?.phone, priv?.emergencyContactName, priv?.emergencyContactPhone]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const phoneChanged = form.phone.trim() !== String(staff?.phone || "").trim();

  const save = async () => {
    const bad = RULES.phone(form.phone);
    if (bad) return setError(bad);
    setSaving(true);
    try {
      const changed = await saveMyContact({
        companyId: user.companyId, branchId: user.branchId, staffId: staff.id, uid: user.uid,
        before: { phone: staff.phone, ...priv }, ...form,
      });
      toast.success(changed ? "Saved" : "Nothing changed");
      onClose();
    } catch (e) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Contact details"
      footer={<Button onClick={save} loading={saving}>Save</Button>}
    >
      <div className="space-y-4">
        <Field label="Your mobile number" error={error} hint={phoneChanged ? "You'll sign in with this new number from now on." : "You also sign in with this number."}>
          {({ id, invalid }) => <Input id={id} size="lg" type="tel" inputMode="tel" value={form.phone} onChange={(e) => { setError(null); set("phone")(e); }} invalid={invalid} placeholder="012-345 6789" />}
        </Field>
        <div className="rounded-2xl border border-line p-4">
          <p className="mb-3 text-sm font-semibold">Emergency contact</p>
          <div className="space-y-3">
            <Field label="Name">
              {({ id }) => <Input id={id} size="lg" value={form.emergencyContactName} onChange={set("emergencyContactName")} placeholder="Who to call" />}
            </Field>
            <Field label="Their phone">
              {({ id }) => <Input id={id} size="lg" type="tel" inputMode="tel" value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} placeholder="012-345 6789" />}
            </Field>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** A 6-digit PIN box: big, spaced, numbers only, with show/hide. */
function PinInput({ id, value, onChange, invalid, show, autoComplete }) {
  return (
    <Input
      id={id}
      size="lg"
      type={show ? "text" : "password"}
      inputMode="numeric"
      autoComplete={autoComplete}
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      invalid={invalid}
      placeholder="••••••"
      className="text-center text-lg font-semibold tracking-[0.6em]"
    />
  );
}

/** Change the PIN: the current one, then the new one twice. */
export function PinSheet({ open, onClose }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setCur(""); setNext(""); setAgain(""); setError({}); setShow(false); }
  }, [open]);

  const save = async () => {
    const e = {};
    if (cur.length !== 6) e.cur = "Type your current 6-digit PIN.";
    if (next.length !== 6) e.next = "The new PIN must be 6 digits.";
    else if (weakPin(next)) e.next = "Too easy to guess — avoid 111111 or 123456.";
    else if (next === cur) e.next = "That's your current PIN.";
    if (!e.next && again !== next) e.again = "The two new PINs are not the same.";
    setError(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await changeMyPin(cur, next);
      toast.success("PIN changed");
      onClose();
    } catch (err) {
      const msg = pinChangeError(err);
      setError(msg.includes("current PIN") ? { cur: msg } : { next: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change your PIN"
      description="Keep it to yourself — anyone with your number and PIN can see your pay."
      footer={<Button onClick={save} loading={saving}>Change PIN</Button>}
    >
      <div className="space-y-4">
        <Field label="Current PIN" error={error.cur}>
          {({ id, invalid }) => <PinInput id={id} value={cur} onChange={setCur} invalid={invalid} show={show} autoComplete="current-password" />}
        </Field>
        <Field label="New PIN" error={error.next}>
          {({ id, invalid }) => <PinInput id={id} value={next} onChange={setNext} invalid={invalid} show={show} autoComplete="new-password" />}
        </Field>
        <Field label="New PIN again" error={error.again}>
          {({ id, invalid }) => <PinInput id={id} value={again} onChange={setAgain} invalid={invalid} show={show} autoComplete="new-password" />}
        </Field>
        <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {show ? "Hide" : "Show"} the numbers
        </button>
        <p className="text-xs text-subtle">Forgot your PIN? Your manager can make you a new one from Staff management.</p>
      </div>
    </Sheet>
  );
}
