"use client";
// The branch kiosk tablet (11 Nov 2026, lib/attendance/kiosk.js). Set up once
// from /kiosk; after that no sign-in. Face first: stand in front of the
// camera, your name comes up, tap Clock in / Clock out. PIN second: tap your
// name, enter your PIN. In or out is worked out by the server; with no
// internet faces can't be checked, so it is the PIN, and the punch is kept
// here and sent later.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Delete, Fingerprint, KeyRound, Loader2, LogIn, LogOut, ScanFace, Search, Wifi, WifiOff, X } from "lucide-react";
import { roleLabelOf } from "@/app/staff-management/lib/constants";
import { verifyBiometric } from "@/lib/attendance/biometric";
import { cachedState, clearDropped, dropped, identify, keep, kioskToken, loadState, punchId, queued, sendKept, sendPunch, snapshot } from "@/lib/attendance/kioskClient";

const time = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");
/** A face must fill at least this much of the picture's width to be read (they are standing at the tablet). */
const NEAR = 0.16;

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center tabular-nums">
      <div className="text-4xl font-black tracking-tight text-white md:text-5xl">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</div>
      <div className="text-sm font-medium text-white/50">{now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</div>
    </div>
  );
}

function Face({ s, size = "size-16" }) {
  return s.photoUrl ? (
    <img src={s.photoUrl} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <div className={`${size} flex items-center justify-center rounded-full bg-white/10 text-lg font-black text-white/80`}>
      {(s.firstName?.[0] || "") + (s.lastName?.[0] || "")}
    </div>
  );
}

/** A <video> showing a camera stream the page already holds. */
function Live({ stream, className = "" }) {
  const v = useRef(null);
  useEffect(() => {
    if (v.current && stream) {
      v.current.srcObject = stream;
      v.current.play().catch(() => {});
    }
  }, [stream]);
  return <video ref={v} playsInline muted className={`-scale-x-100 object-cover ${className}`} />;
}

/** PIN pad: four digits, then onDone(pin). */
function PinPad({ busy, error, onDone }) {
  const [pin, setPin] = useState("");
  useEffect(() => {
    if (error) setPin("");
  }, [error]);
  const press = (d) => {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) onDone(next);
  };
  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`size-4 rounded-full ${i < pin.length ? "bg-white" : "bg-white/15"}`} />
        ))}
      </div>
      <p className={`min-h-5 text-center text-sm font-semibold ${error ? "text-red-300" : "text-white/50"}`}>{busy ? "Checking…" : error || "Enter your 4-digit PIN"}</p>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="h-16 rounded-2xl bg-white/10 text-2xl font-bold text-white active:bg-white/25">{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")} className="h-16 rounded-2xl bg-white/10 text-2xl font-bold text-white active:bg-white/25">0</button>
        <button type="button" aria-label="Delete" onClick={() => setPin((p) => p.slice(0, -1))} className="flex h-16 items-center justify-center rounded-2xl text-white/60 active:bg-white/10">
          <Delete className="size-6" />
        </button>
      </div>
    </div>
  );
}

/** The big Clock in / out button, with the camera above it when there is one. */
function ConfirmStep({ type, busy, stream, onGo }) {
  const out = type === "out";
  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-3xl bg-black">
        {stream ? <Live stream={stream} className="h-full w-full" /> : <div className="flex h-full items-center justify-center text-sm text-white/50">No camera — saved without a photo</div>}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onGo}
        className={`flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-xl font-black text-black disabled:opacity-50 ${out ? "bg-orange-400" : "bg-emerald-400"}`}
      >
        {busy ? <Loader2 className="size-6 animate-spin" /> : out ? <LogOut className="size-6" /> : <LogIn className="size-6" />}
        {out ? "Clock out" : "Clock in"}
      </button>
    </div>
  );
}

export default function KioskTablet() {
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(true);
  const [notSetUp, setNotSetUp] = useState(false);
  const [waiting, setWaiting] = useState(0); // punches kept on the tablet
  const [q, setQ] = useState("");
  const [flow, setFlow] = useState(null); // { staff, step: bio|nopin|pin|photo, pin, method, type, error, busy, descriptor }
  const [done, setDone] = useState(null); // { name, type, at, kept, earlyOt }
  const [admin, setAdmin] = useState(false);
  const [stream, setStream] = useState(null); // the camera, held for the whole page
  const [faceStatus, setFaceStatus] = useState("loading"); // loading | look | checking | unknown | off
  const taps = useRef({ n: 0, t: 0 });
  const video = useRef(null); // hidden reader of the stream (faces and photos)

  const refresh = useCallback(async () => {
    try {
      const s = await loadState();
      setState(s);
      setOnline(true);
    } catch (e) {
      if (e.notSetUp) setNotSetUp(true);
      else {
        setOnline(false);
        setState((s) => s || cachedState());
      }
    }
  }, []);

  const flush = useCallback(async () => {
    if (!queued().length) return setWaiting(0);
    const r = await sendKept();
    setWaiting(r.left);
    if (r.sent || r.refused) refresh();
  }, [refresh]);

  useEffect(() => {
    if (!kioskToken()) return setNotSetUp(true);
    setState(cachedState());
    setWaiting(queued().length);
    refresh().then(flush);
    const a = setInterval(refresh, 60000);
    const b = setInterval(flush, 30000);
    const on = () => {
      setOnline(true);
      flush();
      refresh();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(a);
      clearInterval(b);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh, flush]);

  // keep the screen awake while the kiosk is open
  useEffect(() => {
    let lock = null;
    const get = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) lock = await navigator.wakeLock.request("screen");
      } catch {
        /* not available: the tablet's own setting decides */
      }
    };
    get();
    document.addEventListener("visibilitychange", get);
    return () => {
      document.removeEventListener("visibilitychange", get);
      lock?.release().catch(() => {});
    };
  }, []);

  const faces = state?.faces || 0;
  const wantCamera = !!state && (state.settings?.camera !== false || faces > 0);

  // one camera stream for the page: faces, and the photo with each punch
  useEffect(() => {
    if (!wantCamera || stream) return;
    let dead = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false })
      .then((s) => {
        if (dead) return s.getTracks().forEach((t) => t.stop());
        setStream(s);
      })
      .catch(() => setFaceStatus("off"));
    return () => {
      dead = true;
    };
  }, [wantCamera, stream]);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  useEffect(() => {
    if (video.current && stream) {
      video.current.srcObject = stream;
      video.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), done.earlyOt ? 4500 : 2800);
    return () => clearTimeout(t);
  }, [done]);

  const faceOn = online && faces > 0 && !!stream;

  // face first: look for a face about once a second while nothing else is open
  const misses = useRef(0);
  useEffect(() => {
    if (!faceOn || flow || done || admin) return;
    let dead = false;
    let busy = false;
    let reader = null;
    import("@/lib/face/faceApi")
      .then((m) => {
        reader = m.readFace;
        return m.loadFaceApi();
      })
      .then(() => !dead && setFaceStatus("look"))
      .catch(() => !dead && setFaceStatus("off"));
    const t = setInterval(async () => {
      if (busy || dead || !reader || !video.current?.videoWidth) return;
      busy = true;
      try {
        const f = await reader(video.current);
        if (dead) return;
        if (!f || f.size < NEAR) {
          misses.current = 0;
          setFaceStatus((s) => (s === "unknown" ? s : "look"));
          return;
        }
        setFaceStatus("checking");
        const r = await identify(f.descriptor);
        if (dead) return;
        if (r.offline) return setOnline(false);
        if (r.ok) {
          misses.current = 0;
          const s = (state?.staff || []).find((x) => x.id === r.staffId) || { id: r.staffId, firstName: r.firstName, lastName: "", photoUrl: r.photoUrl };
          setFlow({ staff: s, step: "photo", method: "face", type: r.type, descriptor: f.descriptor, matched: true });
        } else {
          misses.current += 1;
          setFaceStatus(misses.current >= 2 ? "unknown" : "look");
        }
      } catch {
        /* a bad frame: the next one */
      } finally {
        busy = false;
      }
    }, 900);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [faceOn, flow, done, admin, state]);

  // "not recognised" fades after a while
  useEffect(() => {
    if (faceStatus !== "unknown") return;
    const t = setTimeout(() => {
      misses.current = 0;
      setFaceStatus("look");
    }, 8000);
    return () => clearTimeout(t);
  }, [faceStatus]);

  // a face match nobody confirms goes away
  useEffect(() => {
    if (!flow?.matched || flow.busy) return;
    const t = setTimeout(() => setFlow(null), 10000);
    return () => clearTimeout(t);
  }, [flow]);

  const camera = state?.settings?.camera !== false;
  const close = () => setFlow(null);

  const start = async (s) => {
    const type = s.in ? "out" : "in";
    if (state?.settings?.biometrics && s.credentialId) {
      setFlow({ staff: s, step: "bio", type });
      try {
        if (await verifyBiometric(s.credentialId)) {
          return camera ? setFlow({ staff: s, step: "photo", method: "biometric", type }) : finish({ staff: s, method: "biometric", type });
        }
      } catch {
        /* falls back to the PIN */
      }
    }
    if (!s.hasPin) return setFlow({ staff: s, step: "nopin", type });
    setFlow({ staff: s, step: "pin", type });
  };

  const pinDone = async (pin) => {
    const f = { ...flow, pin, method: "pin" };
    if (online) {
      setFlow({ ...f, busy: true, error: null });
      const r = await sendPunch({ id: punchId(), staffId: f.staff.id, pin, method: "pin", check: true });
      if (r.offline) setOnline(false);
      else if (!r.ok) return setFlow({ ...f, busy: false, error: r.error });
      else f.type = r.type;
    }
    if (camera && stream) setFlow({ ...f, step: "photo", busy: false, error: null });
    else finish(f);
  };

  const finish = async (f) => {
    setFlow({ ...f, step: f.step || "photo", busy: true });
    const photo = camera && video.current ? snapshot(video.current) : null;
    const p = { id: punchId(), staffId: f.staff.id, pin: f.pin || "", method: f.method || "pin", photo, ...(f.method === "face" ? { descriptor: f.descriptor } : {}) };
    const name = f.staff.firstName || f.staff.lastName;
    // a face can't be checked offline: only PIN (or fingerprint) punches are kept
    const r = online ? await sendPunch(p) : { offline: true };
    if (r.offline) {
      setOnline(false);
      if (f.method === "face") {
        setFlow(null);
        return;
      }
      keep({ ...p, name, at: new Date().toISOString() });
      setWaiting(queued().length);
      // shown as in / out here until the server says otherwise
      setState((s) => s && { ...s, staff: s.staff.map((x) => (x.id === f.staff.id ? { ...x, in: f.type === "in", since: f.type === "in" ? new Date().toISOString() : null } : x)) });
      setFlow(null);
      return setDone({ name, type: f.type, at: new Date().toISOString(), kept: true });
    }
    if (!r.ok) return setFlow({ ...f, step: f.method === "pin" ? "pin" : "photo", busy: false, error: r.error });
    setFlow(null);
    setDone({ name, type: r.type, at: r.at, earlyOt: r.earlyOt });
    refresh();
  };

  const cornerTap = () => {
    const now = Date.now();
    taps.current = now - taps.current.t < 2000 ? { n: taps.current.n + 1, t: now } : { n: 1, t: now };
    if (taps.current.n >= 5) {
      taps.current = { n: 0, t: 0 };
      setAdmin(true);
    }
  };

  if (notSetUp) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-6 text-center text-white">
        <h1 className="text-2xl font-black">This tablet is not a kiosk yet</h1>
        <p className="max-w-md text-white/60">Sign in on this tablet with the branch&apos;s kiosk login (or a manager), open <b>Open Kiosk</b> and tap <b>Use this tablet as the kiosk</b>. After that nobody needs to sign in here.</p>
        <Link href="/kiosk" className="rounded-2xl bg-white px-6 py-3 font-bold text-gray-950">Set up this tablet</Link>
      </main>
    );
  }

  const staff = (state?.staff || []).filter((s) => !q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q.toLowerCase()));
  const inNow = (state?.staff || []).filter((s) => s.in).length;
  const s = flow?.staff;
  const faceText = {
    loading: "Getting face recognition ready…",
    look: "Look at the camera",
    checking: "Checking…",
    unknown: "Not recognised — tap your name to use your PIN",
    off: "Camera not available — tap your name to use your PIN",
  }[faceStatus];

  return (
    <main className="flex h-[100dvh] select-none flex-col overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <button type="button" aria-hidden tabIndex={-1} onClick={cornerTap} className="absolute left-0 top-0 z-50 size-20 opacity-0" />
      <video ref={video} playsInline muted className="hidden" />

      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-black">{state?.branch?.name || "Kiosk"}</p>
          <p className="text-xs font-semibold text-white/50">{inNow} in now</p>
        </div>
        <LiveClock />
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${online ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>
          {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
          {online ? "Online" : "No internet — use your PIN; punches are kept"}
          {waiting > 0 && <span className="rounded-full bg-white/15 px-2">{waiting} waiting</span>}
        </div>
      </header>

      <div className={`mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 px-5 pb-5 ${faceOn ? "md:flex-row" : ""}`}>
        {faceOn && (
          <section className="flex shrink-0 flex-col items-center gap-3 md:w-[42%]">
            <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-[2rem] bg-black ring-1 ring-white/10 md:max-w-none">
              <Live stream={stream} className="h-full w-full" />
              <div className="pointer-events-none absolute inset-[18%_22%] rounded-[45%] border-2 border-white/40" />
            </div>
            <p className={`flex items-center gap-2 text-center text-lg font-bold ${faceStatus === "unknown" ? "text-amber-200" : "text-white/80"}`}>
              {faceStatus === "checking" || faceStatus === "loading" ? <Loader2 className="size-5 animate-spin" /> : <ScanFace className="size-5" />}
              {faceText}
            </p>
          </section>
        )}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {faceOn && (
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
              <KeyRound className="size-4" /> Or tap your name for your PIN
            </p>
          )}
          <label className="mb-3 flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-white/10 px-4">
            <Search className="size-5 text-white/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your name" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-white/40" />
            {q && (
              <button type="button" aria-label="Clear" onClick={() => setQ("")}>
                <X className="size-5 text-white/50" />
              </button>
            )}
          </label>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!state ? (
              <div className="flex h-full items-center justify-center text-white/40">
                <Loader2 className="mr-2 size-5 animate-spin" /> Loading…
              </div>
            ) : (
              <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${faceOn ? "lg:grid-cols-3" : "md:grid-cols-4 lg:grid-cols-5"}`}>
                {staff.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => start(x)}
                    className={`relative flex flex-col items-center rounded-3xl border p-4 transition active:scale-95 ${x.in ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}
                  >
                    <Face s={x} />
                    <span className="mt-2 line-clamp-2 text-center text-sm font-bold leading-tight">{x.firstName} {x.lastName}</span>
                    <span className="mt-0.5 text-[11px] text-white/40">{roleLabelOf(x.role) || "Staff"}</span>
                    <span className={`mt-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${x.in ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-white/50"}`}>
                      {x.in ? `In since ${time(x.since)}` : "Not in"}
                    </span>
                    {state.settings?.biometrics && x.credentialId && <Fingerprint className="absolute right-3 top-3 size-4 text-white/30" />}
                  </button>
                ))}
                {!staff.length && <p className="col-span-full py-10 text-center text-white/40">No one by that name</p>}
              </div>
            )}
          </div>
        </section>
      </div>

      {flow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-5 rounded-[2rem] bg-gray-900 p-6 shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Back" onClick={close} className="rounded-full p-2 text-white/60 active:bg-white/10">
                <ChevronLeft className="size-6" />
              </button>
              <Face s={s} size="size-12" />
              <div className="min-w-0">
                <p className="truncate text-lg font-black">{s.firstName} {s.lastName}</p>
                <p className={`text-sm font-bold ${flow.type === "out" ? "text-orange-300" : "text-emerald-300"}`}>{flow.type === "out" ? "Clocking out" : "Clocking in"}</p>
              </div>
            </div>
            {flow.step === "bio" && (
              <p className="flex items-center justify-center gap-2 py-8 text-white/70">
                <Fingerprint className="size-6" /> Touch the fingerprint sensor…
              </p>
            )}
            {flow.step === "nopin" && <p className="py-6 text-center text-white/70">{s.firstName} has no kiosk PIN yet. Ask the manager to set one.</p>}
            {flow.step === "pin" && <PinPad busy={flow.busy} error={flow.error} onDone={pinDone} />}
            {flow.step === "photo" && (
              <>
                {flow.error && <p className="text-center text-sm font-semibold text-red-300">{flow.error}</p>}
                <ConfirmStep type={flow.type} busy={flow.busy} stream={camera ? stream : null} onGo={() => finish(flow)} />
                {flow.matched && (
                  <button type="button" onClick={() => setFlow({ staff: s, step: s.hasPin ? "pin" : "nopin", type: flow.type })} className="w-full text-center text-sm font-semibold text-white/60 underline">
                    Not {s.firstName}? Use the PIN
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {done && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className={`max-w-sm rounded-[2rem] px-10 py-8 text-center text-black shadow-2xl ${done.type === "out" ? "bg-orange-400" : "bg-emerald-400"}`}>
            <Check className="mx-auto mb-2 size-12" strokeWidth={3} />
            <p className="text-2xl font-black">{done.type === "out" ? `Goodbye, ${done.name}` : `Welcome, ${done.name}`}</p>
            <p className="mt-1 font-semibold">{done.type === "out" ? "Clocked out" : "Clocked in"} at {time(done.at)}</p>
            {done.kept && <p className="mt-2 text-sm font-semibold">No internet: saved on this tablet, sent when it is back.</p>}
            {done.earlyOt && <p className="mt-2 text-sm font-semibold">{done.earlyOt} min before your shift — the extra time waits for approval.</p>}
          </div>
        </div>
      )}

      {admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md space-y-4 rounded-[2rem] bg-gray-900 p-6 ring-1 ring-white/10">
            <p className="text-lg font-black">Kiosk</p>
            <p className="text-sm text-white/60">{state?.device?.name} · {waiting} punch{waiting === 1 ? "" : "es"} waiting to be sent · {faces} face{faces === 1 ? "" : "s"} added</p>
            {dropped().length > 0 && (
              <div className="space-y-1 rounded-2xl bg-red-500/10 p-3 text-sm">
                <p className="font-bold text-red-200">Not saved (typed with no internet, refused later):</p>
                {dropped().map((d, i) => (
                  <p key={i} className="text-white/70">{d.name} · {new Date(d.at).toLocaleString()} — {d.why}</p>
                ))}
                <button type="button" onClick={() => { clearDropped(); setAdmin(false); }} className="mt-1 text-xs font-bold text-white/60 underline">Clear this list</button>
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setAdmin(false)} className="h-12 flex-1 rounded-2xl bg-white/10 font-bold">Back to kiosk</button>
              <Link href="/kiosk" className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white font-bold text-gray-950">Close kiosk</Link>
            </div>
            <p className="text-xs text-white/40">Closing needs the kiosk login (or a manager) to sign in. The tablet stays set up. Faces and PINs are added there.</p>
          </div>
        </div>
      )}
    </main>
  );
}
