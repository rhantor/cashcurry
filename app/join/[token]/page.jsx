"use client";
// A new hire's join link (30 Oct, lib/hires/model.js): no sign-in, on their
// phone. Step by step: their details, address and someone to call, bank (if
// they like), their documents (IC or passport, photo; bank card and health
// certificate if they have them), then their appointment letter — read and
// signed — and send. What they type stays on this phone until it is sent.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ArrowRight, Camera, Check, CircleAlert, FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button, Field, Input, LogoMark, Select, cn } from "@/app/components/ui";
import FileViewer from "@/app/components/common/FileViewer";
import { COUNTRIES } from "@/app/staff-management/lib/countries";
import { STATES_MY } from "@/app/staff-management/lib/constants";
import { RULES } from "@/app/staff-management/lib/validation";
import { LINK_DAYS, MAX_HEALTH_FILES, detailProblems, docKinds, fileProblem, missingDocs } from "@/lib/hires/model";
import { shrinkPhoto } from "@/lib/chat/client";
import { letterForHire } from "@/app/tools/appointment-letter/letterForHire";

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];
const day = (d) => (d ? format(parseISO(d), "d MMM yyyy") : "");
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));

// which step each field is on, to go back to the first one with a problem
const STEP_OF = {
  firstName: "you", lastName: "you", gender: "you", dob: "you", nationality: "you", icNumber: "you", passportNumber: "you",
  phone: "contact", email: "contact", addressLine1: "contact", emergencyContactName: "contact", emergencyContactPhone: "contact",
};

export default function JoinPage() {
  const { token } = useParams();
  const key = `cc_join_${String(token).slice(0, 10)}`;
  const [info, setInfo] = useState(null); // what the server says about this link
  const [details, setDetails] = useState({});
  const [files, setFiles] = useState({});
  const [step, setStep] = useState("start");
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState(null);

  useEffect(() => {
    let live = true;
    post("/api/join", { token }).then(({ ok, data }) => {
      if (!live) return;
      if (!ok) return setInfo({ state: "error" });
      setInfo(data);
      setFiles(data.files || {});
      let kept = {};
      try {
        kept = JSON.parse(localStorage.getItem(key) || "{}");
      } catch {
        /* private mode */
      }
      setDetails({ country: "Malaysia", ...(data.details || {}), ...kept });
    });
    return () => {
      live = false;
    };
  }, [token, key]);

  const set = (k, v) => {
    setDetails((d) => {
      const next = { ...d, [k]: v };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* private mode: still works for this visit */
      }
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const steps = useMemo(() => ["start", "you", "contact", "bank", "docs", ...(info?.letter ? ["letter"] : []), "send"], [info?.letter]);
  const at = steps.indexOf(step);
  const go = (s) => {
    setStep(s);
    setProblem("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // a step's own checks before moving on
  const checkStep = () => {
    const all = detailProblems(details, RULES);
    const here = Object.fromEntries(Object.entries(all).filter(([k]) => STEP_OF[k] === step));
    setErrors(here);
    if (Object.keys(here).length) {
      setProblem("Check the highlighted fields");
      return false;
    }
    if (step === "docs" && missingDocs(files, details).length) {
      setProblem("Add the documents marked as needed");
      return false;
    }
    if (step === "letter" && !(agreed && signature)) {
      setProblem("Tick that you accept the letter, and sign");
      return false;
    }
    return true;
  };
  const next = () => checkStep() && go(steps[at + 1]);

  const send = async () => {
    setSending(true);
    setProblem("");
    const { ok, data } = await post("/api/join/submit", { token, details, signature, agreed });
    setSending(false);
    if (ok) {
      setSent(true);
      try {
        localStorage.removeItem(key);
      } catch {
        /* nothing kept */
      }
      return;
    }
    setProblem(data.error || "Couldn't send it. Try again.");
    if (data.problems) {
      setErrors(data.problems);
      const first = Object.keys(data.problems).map((k) => STEP_OF[k]).find(Boolean);
      if (first) go(first);
    } else if (data.missing) go("docs");
  };

  if (!info) {
    return (
      <Frame>
        <div className="flex flex-1 items-center justify-center py-24 text-muted">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </Frame>
    );
  }
  if (sent || info.state !== "open") {
    const msg = sent
      ? { title: `Thank you${details.firstName ? `, ${details.firstName}` : ""}!`, body: `Your details are with ${info.company || "your new employer"}. They will be in touch about your first day.`, ok: true }
      : info.state === "used"
      ? { title: "Already sent", body: "This form has been filled in. If something needs changing, ask them to send you a new link.", ok: true }
      : info.state === "expired"
      ? { title: "This link has expired", body: `Links work for ${LINK_DAYS} days. Ask ${info.company || "them"} to send you a new one.` }
      : { title: "This link doesn't work", body: "It may have been replaced by a newer one. Ask whoever sent it for a new link." };
    return (
      <Frame company={info.company}>
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span className={cn("flex size-14 items-center justify-center rounded-full", msg.ok ? "bg-brand-soft text-brand" : "bg-warning-soft text-warning")}>
            {msg.ok ? <Check className="size-7" strokeWidth={2.5} /> : <CircleAlert className="size-7" />}
          </span>
          <h1 className="text-xl font-semibold text-fg">{msg.title}</h1>
          <p className="max-w-sm text-sm text-muted">{msg.body}</p>
        </div>
      </Frame>
    );
  }

  const malaysian = String(details.nationality || "").toLowerCase() === "malaysian";
  const field = (k, label, props = {}) => (
    <Field label={label} error={errors[k]} hint={props.hint}>
      {({ id, invalid }) => <Input id={id} invalid={invalid} size="lg" value={details[k] || ""} onChange={(e) => set(k, e.target.value)} {...props} hint={undefined} />}
    </Field>
  );
  const select = (k, label, options) => (
    <Field label={label} error={errors[k]}>
      {({ id, invalid }) => (
        <Select id={id} invalid={invalid} className="h-12" value={details[k] || ""} onChange={(e) => set(k, e.target.value)}>
          <option value="">Choose…</option>
          {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
        </Select>
      )}
    </Field>
  );

  return (
    <Frame company={info.company} progress={at / (steps.length - 1)}>
      <div className="space-y-5 px-4 pb-32 pt-5">
        {step === "start" && (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-muted">{info.branch}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-fg">Welcome{details.firstName ? `, ${details.firstName}` : ""}!</h1>
            </div>
            <div className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
              {info.job && <Row label="Job">{info.job}</Row>}
              {info.startDate && <Row label="Starting">{day(info.startDate)}</Row>}
              <Row label="Link works until">{day(info.expiresAt?.slice(0, 10))}</Row>
            </div>
            <p className="text-sm text-muted">
              Fill in your details and add photos of your documents{info.letter ? ", then read and sign your appointment letter" : ""}. It takes about 5 minutes. Have your IC or passport ready.
            </p>
            <ul className="space-y-1.5 text-sm text-fg">
              {docKinds(details).map((d) => (
                <li key={d.kind} className="flex items-center gap-2">
                  <span className={cn("size-1.5 rounded-full", d.required ? "bg-brand" : "bg-subtle")} />
                  {d.label}
                  {!d.required && <span className="text-xs text-muted">(if you have it)</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === "you" && (
          <Section title="About you" note="As on your IC or passport.">
            <div className="grid grid-cols-2 gap-3">
              {field("firstName", "First name", { autoComplete: "given-name" })}
              {field("lastName", "Last name", { autoComplete: "family-name" })}
            </div>
            {select("gender", "Gender", GENDERS)}
            {field("dob", "Date of birth", { type: "date", max: new Date().toISOString().slice(0, 10) })}
            {select("nationality", "Nationality", COUNTRIES)}
            {details.nationality && (malaysian ? field("icNumber", "IC number", { placeholder: "000000-00-0000", inputMode: "numeric" }) : field("passportNumber", "Passport number"))}
          </Section>
        )}

        {step === "contact" && (
          <Section title="Contact and address">
            {field("phone", "Mobile number", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
            {field("email", "Email (optional)", { type: "email", autoComplete: "email" })}
            {field("addressLine1", "Address", { autoComplete: "address-line1", placeholder: "House no., street" })}
            {field("addressLine2", "Address line 2 (optional)", { autoComplete: "address-line2" })}
            <div className="grid grid-cols-2 gap-3">
              {field("postalCode", "Postcode", { inputMode: "numeric", autoComplete: "postal-code" })}
              {field("city", "City", { autoComplete: "address-level2" })}
            </div>
            {details.country === "Malaysia" ? select("state", "State", STATES_MY) : field("state", "State / region")}
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm font-semibold text-fg">Someone to call in an emergency</p>
              {field("emergencyContactName", "Their name")}
              {field("emergencyContactPhone", "Their phone", { type: "tel", inputMode: "tel" })}
            </div>
          </Section>
        )}

        {step === "bank" && (
          <Section title="Your bank (optional)" note="For your salary. You can also give it to your manager later.">
            {field("bankName", "Bank", { placeholder: "e.g. Maybank" })}
            {field("bankAccountNumber", "Account number", { inputMode: "numeric" })}
            {field("bankAccountHolderName", "Name on the account")}
          </Section>
        )}

        {step === "docs" && (
          <Section title="Your documents" note="Take a photo, or choose a photo or PDF. Make sure everything can be read.">
            {docKinds(details).map((d) => (
              <DocSlot key={d.kind} doc={d} token={token} value={files[d.kind]} onChange={(v) => setFiles((f) => ({ ...f, [d.kind]: v }))} />
            ))}
          </Section>
        )}

        {step === "letter" && info.letter && (
          <LetterStep letter={info.letter} details={details} currency={info.currency} agreed={agreed} setAgreed={setAgreed} signature={signature} setSignature={setSignature} />
        )}

        {step === "send" && (
          <Section title="Check and send">
            <div className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
              <Row label="Name">{[details.firstName, details.lastName].filter(Boolean).join(" ")}</Row>
              <Row label={malaysian ? "IC" : "Passport"}>{malaysian ? details.icNumber : details.passportNumber}</Row>
              <Row label="Phone">{details.phone}</Row>
              <Row label="Address">{[details.addressLine1, details.addressLine2, details.postalCode, details.city, details.state].filter(Boolean).join(", ")}</Row>
              <Row label="Emergency">{[details.emergencyContactName, details.emergencyContactPhone].filter(Boolean).join(" · ")}</Row>
              <Row label="Bank">{[details.bankName, details.bankAccountNumber].filter(Boolean).join(" · ") || "—"}</Row>
              <Row label="Documents">{docKinds(details).filter((d) => (d.many ? (files[d.kind] || []).length : files[d.kind])).map((d) => d.label).join(", ")}</Row>
              {info.letter && <Row label="Letter">Signed</Row>}
            </div>
            <p className="text-xs text-muted">Once sent, this link can&apos;t be used again. If something needs changing later, ask for a new link.</p>
          </Section>
        )}

        {problem && (
          <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {problem}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          {at > 0 && <Button variant="secondary" size="lg" icon={ArrowLeft} onClick={() => go(steps[at - 1])} aria-label="Back" />}
          {step === "send" ? (
            <Button size="lg" className="flex-1" loading={sending} icon={Check} onClick={send}>Send to {info.company || "them"}</Button>
          ) : (
            <Button size="lg" className="flex-1" onClick={next}>
              {step === "start" ? "Start" : "Next"} <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </Frame>
  );
}

function Frame({ company, progress, children }) {
  return (
    <div className="min-h-[100dvh] bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-4 py-3">
          <LogoMark size={28} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{company ? `Joining ${company}` : "Cash Curry"}</span>
        </div>
        {progress != null && (
          <div className="h-1 bg-surface-2">
            <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        )}
      </header>
      <main className="mx-auto flex max-w-md flex-col">{children}</main>
    </div>
  );
}

const Section = ({ title, note, children }) => (
  <section className="space-y-4">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
      {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
    </div>
    {children}
  </section>
);

const Row = ({ label, children }) => (
  <div className="flex gap-3">
    <span className="w-28 shrink-0 text-muted">{label}</span>
    <span className="min-w-0 flex-1 break-words font-medium text-fg">{children || "—"}</span>
  </div>
);

/** One document: what it is, whether it is in, and buttons to add (or take away) one. */
function DocSlot({ doc: d, token, value, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = d.many ? value || [] : value ? [value] : [];
  const full = d.many ? list.length >= MAX_HEALTH_FILES : list.length > 0;

  const pick = async (e) => {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;
    setErr("");
    const file = raw.type.startsWith("image/") ? await shrinkPhoto(raw) : raw;
    const problem = fileProblem(d.kind, { contentType: file.type, size: file.size });
    if (problem) return setErr(problem);
    setBusy(true);
    const form = new FormData();
    form.append("token", token);
    form.append("kind", d.kind);
    form.append("file", file);
    try {
      const res = await fetch("/api/join/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't send it");
      onChange(d.many ? [...list, data.file] : data.file);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (i) => {
    setBusy(true);
    await post("/api/join/upload", { token, kind: d.kind, remove: i });
    setBusy(false);
    onChange(d.many ? list.filter((_, j) => j !== i) : null);
  };

  return (
    <div className={cn("space-y-2 rounded-2xl border bg-surface p-4", list.length ? "border-brand/40" : "border-line")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", list.length ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted")}>
          {list.length ? <Check className="size-3.5" strokeWidth={3} /> : <FileText className="size-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">
            {d.label} {d.required ? <span className="text-xs font-medium text-warning">needed</span> : <span className="text-xs font-normal text-muted">if you have it</span>}
          </p>
          {d.hint && <p className="text-xs text-muted">{d.hint}</p>}
        </div>
      </div>
      {list.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-fg">{f.name}</span>
          <button type="button" onClick={() => remove(i)} disabled={busy} className="rounded-md p-1.5 text-muted hover:text-danger" aria-label={`Remove ${f.name}`}>
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      {!full && (
        <Button variant="secondary" className="w-full" icon={Camera} loading={busy} onClick={() => input.current?.click()}>
          {list.length ? (d.many ? "Add another" : "Change it") : d.image ? "Take or choose a photo" : "Take a photo or choose a file"}
        </Button>
      )}
      {full && !d.many && (
        <button type="button" onClick={() => input.current?.click()} className="text-xs font-semibold text-brand hover:underline" disabled={busy}>
          Change it
        </button>
      )}
      <input ref={input} type="file" hidden accept={d.image ? "image/*" : "image/*,application/pdf"} onChange={pick} />
      {err && <p className="text-xs font-medium text-danger">{err}</p>}
    </div>
  );
}

/** Their appointment letter, with their own details in: read it, tick, sign. */
function LetterStep({ letter, details, currency, agreed, setAgreed, signature, setSignature }) {
  const [viewer, setViewer] = useState(null);
  const terms = letter.jobTerms || {};
  const read = () => {
    try {
      const { blob } = letterForHire(letter, { details, currency });
      setViewer({ url: URL.createObjectURL(blob), label: "Appointment letter", pdf: true });
    } catch {
      setViewer(null);
    }
  };
  return (
    <Section title="Your appointment letter" note="Read it all, then sign below. A copy with your signature stays with your employer.">
      <div className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
        {terms.title && <Row label="Job">{terms.title}</Row>}
        {terms.commencementDate && <Row label="Starting">{terms.commencementDate}</Row>}
        {terms.basicSalary && <Row label={terms.salaryLabel || "Basic salary"}>{`${currency} ${terms.basicSalary}`}</Row>}
        {terms.probationPeriod && <Row label={terms.durationLabel || "Probation"}>{`${terms.probationPeriod} months`}</Row>}
        {terms.workingHours && <Row label="Hours">{terms.workingHours}</Row>}
      </div>
      <Button variant="secondary" className="w-full" icon={FileText} onClick={read}>Read the whole letter</Button>
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--cc-brand)]" />
        <span>I have read, understood and accept this appointment under the terms in this letter.</span>
      </label>
      <SignPad value={signature} onChange={setSignature} />
      <FileViewer open={!!viewer} items={viewer ? [viewer] : []} onClose={() => setViewer(null)} />
    </Section>
  );
}

/** Sign with a finger: a PNG of the strokes. */
function SignPad({ value, onChange }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const drawn = useRef(false);
  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1d3a8a";
    drawn.current = false;
  }, []);
  // drawn again when coming back to this step; cleared when Clear is pressed
  useEffect(() => {
    setup();
    if (value) {
      const img = new Image();
      img.onload = () => canvas.current?.getContext("2d").drawImage(img, 0, 0, canvas.current.clientWidth, canvas.current.clientHeight);
      img.src = value;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!value) setup();
  }, [value, setup]);
  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const down = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvas.current.getContext("2d");
    ctx.lineTo(...point(e));
    ctx.stroke();
    drawn.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (drawn.current) onChange(canvas.current.toDataURL("image/png"));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-fg">Sign here</p>
        <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
          <RotateCcw className="size-3.5" /> Clear
        </button>
      </div>
      <canvas
        ref={canvas}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={cn("h-40 w-full touch-none rounded-2xl border-2 border-dashed bg-white", value ? "border-brand/50" : "border-line")}
        aria-label="Signature pad: draw your signature with your finger"
      />
      {!value && <p className="text-xs text-muted">Draw your signature with your finger.</p>}
    </div>
  );
}
