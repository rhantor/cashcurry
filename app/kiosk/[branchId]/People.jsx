"use client";
// Faces and kiosk PINs (11 Nov 2026), on the kiosk setup page: for the kiosk
// login and managers. A face is taken on the kiosk tablet itself (same camera,
// same light) as a few pictures turned into numbers; only the numbers go to
// the server. A PIN is made here and shown once.
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, ScanFace, Trash2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import useRetryOnError from "@/app/hooks/useRetryOnError";
import { Avatar, Badge, Button, Sheet, confirmDialog, toast } from "@/app/components/ui";

const SAMPLES = 5;
const NEAR = 0.2;

async function api(path, method, body, query = "") {
  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch(`${path}${query}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ""}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

/** Take a face: a few clear pictures, as numbers. */
function FaceSheet({ person, companyId, branchId, onClose, onSaved }) {
  const video = useRef(null);
  const [status, setStatus] = useState("Starting the camera…");
  const [samples, setSamples] = useState([]);
  const [taking, setTaking] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const stop = useRef(false);

  useEffect(() => {
    if (!person) return;
    let stream = null;
    stop.current = false;
    setSamples([]);
    setConsent(false);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
        if (stop.current) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
      } catch {
        return setStatus("No camera here — add faces on the kiosk tablet.");
      }
      try {
        setStatus("Getting face recognition ready…");
        await (await import("@/lib/face/human")).loadFace();
        setStatus("Ready");
      } catch (e) {
        console.error("face models", e);
        setStatus("Couldn't load face recognition — check the internet and open this again.");
      }
    })();
    return () => {
      stop.current = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [person]);

  const take = async () => {
    setTaking(true);
    setSamples([]);
    const { readFace } = await import("@/lib/face/human");
    const got = [];
    const until = Date.now() + 25000;
    while (got.length < SAMPLES && Date.now() < until && !stop.current) {
      try {
        const f = await readFace(video.current);
        if (!f) setStatus("Look straight at the camera");
        else if (f.count > 1) setStatus("Only one person in front of the camera, please");
        else if (f.size < NEAR) setStatus("Come a little closer");
        else {
          got.push(f.descriptor);
          setSamples([...got]);
          setStatus(`Got ${got.length} of ${SAMPLES} — move your head a little`);
        }
      } catch {
        /* a bad frame */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    setStatus(got.length >= SAMPLES ? "Done — save it" : "Couldn't get clear pictures. Better light helps; try again.");
    setTaking(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/kiosk/faces", "POST", { companyId, branchId, staffId: person.id, samples, consent });
      toast.success(`${person.firstName}'s face added`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!person} onClose={onClose} title={person ? `Face — ${person.firstName} ${person.lastName || ""}` : ""} description="Do this on the kiosk tablet. Only they stand in front of the camera.">
      {person && (
        <div className="space-y-4">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-3xl bg-black">
            <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            <div className="pointer-events-none absolute inset-[15%_22%] rounded-[45%] border-2 border-white/50" />
          </div>
          <p className="text-center text-sm font-semibold text-fg">{status}</p>
          <div className="flex justify-center gap-1.5">
            {Array.from({ length: SAMPLES }, (_, i) => (
              <span key={i} className={`size-2.5 rounded-full ${i < samples.length ? "bg-brand" : "bg-line"}`} />
            ))}
          </div>
          <label className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-fg">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4" />
            <span>{person.firstName} agrees that their face is used to clock in and out here. It is kept only for attendance and removed when they leave.</span>
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" icon={ScanFace} loading={taking} disabled={["No camera", "Starting", "Getting", "Couldn't load"].some((x) => status.startsWith(x))} onClick={take}>
              {samples.length ? "Take again" : "Take the face"}
            </Button>
            <Button className="flex-1" loading={saving} disabled={samples.length < SAMPLES || !consent || taking} onClick={save}>Save</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default function KioskPeople({ companyId, branchId }) {
  const staffQ = useGetStaffListQuery({ companyId, branchId }, { skip: !companyId || !branchId });
  useRetryOnError(staffQ);
  const { data: staff = [], isLoading, isError: staffFailed, refetch } = staffQ;
  const [faces, setFaces] = useState(null); // { staffId: { at, by } }
  const [enrol, setEnrol] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const r = await api("/api/kiosk/faces", "GET", null, `?companyId=${encodeURIComponent(companyId)}&branchId=${encodeURIComponent(branchId)}`);
      setFaces(Object.fromEntries(r.faces.map((f) => [f.staffId, f])));
    } catch (e) {
      setFaces({});
      toast.error(e.message);
    }
  }, [companyId, branchId]);
  useEffect(() => {
    load();
  }, [load]);

  const removeFace = async (p) => {
    if (!(await confirmDialog({ title: `Remove ${p.firstName}'s face?`, message: "They clock in with their PIN until a face is added again.", confirmLabel: "Remove", danger: true }))) return;
    setBusy(p.id);
    try {
      await api("/api/kiosk/faces", "DELETE", { companyId, branchId, staffId: p.id });
      toast.success("Removed");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const newPin = async (p) => {
    if (p.pinCode && !(await confirmDialog({ title: `New PIN for ${p.firstName}?`, message: "Their old PIN stops working.", confirmLabel: "Make a new PIN" }))) return;
    setBusy(p.id);
    try {
      const { pin } = await api("/api/kiosk/pin", "POST", { companyId, branchId, staffId: p.id });
      refetch();
      await confirmDialog({ title: `${p.firstName}'s kiosk PIN: ${pin}`, message: "Tell them now. It is not shown here again.", confirmLabel: "Done", cancelLabel: "Close" });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const sorted = [...staff].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  const withFace = faces ? sorted.filter((p) => faces[p.id]?.current).length : 0;

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Faces and PINs</p>
        {faces && <p className="text-xs text-muted">{withFace} of {sorted.length} with a face</p>}
      </div>
      <p className="text-sm text-muted">Face first: staff stand in front of the kiosk and their name comes up. Anyone without a face — or when the internet is down — uses their PIN.</p>
      {isLoading || faces === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {sorted.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={`${p.firstName} ${p.lastName || ""}`} src={p.photoUrl || undefined} size="md" />
              <div className="min-w-[9rem] flex-1">
                <p className="truncate font-semibold text-fg">{p.firstName} {p.lastName}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {faces[p.id]?.current ? <Badge tone="success">Face added</Badge> : faces[p.id] ? <Badge tone="warning">Take the face again</Badge> : <Badge>No face</Badge>}
                  {/^\d{4}$/.test(String(p.pinCode || "")) ? <Badge tone="info">PIN set</Badge> : <Badge tone="warning">No PIN</Badge>}
                </div>
              </div>
              {/* on a phone the buttons go on their own line */}
              <div className="flex w-full flex-wrap gap-1.5 pl-12 sm:w-auto sm:pl-0">
                <Button size="sm" variant="secondary" icon={ScanFace} onClick={() => setEnrol(p)}>{faces[p.id] ? "Redo face" : "Add face"}</Button>
                <Button size="sm" variant="ghost" icon={busy === p.id ? Loader2 : KeyRound} disabled={busy === p.id} onClick={() => newPin(p)}>New PIN</Button>
                {faces[p.id] && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${p.firstName}'s face`} disabled={busy === p.id} onClick={() => removeFace(p)} />}
              </div>
            </li>
          ))}
          {!sorted.length && <li className="px-4 py-3 text-sm text-muted">{staffFailed ? "Couldn't load the staff list — reload the page." : "No staff at this branch yet."}</li>}
        </ul>
      )}
      <FaceSheet person={enrol} companyId={companyId} branchId={branchId} onClose={() => setEnrol(null)} onSaved={load} />
    </section>
  );
}
