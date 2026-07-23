/* eslint-disable react/prop-types */
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { ScanFace, Loader2, KeyRound, AlertTriangle, LogIn, LogOut, Check } from "lucide-react";
import {
  loadFaceApi,
  detectDescriptor,
  processFrame,
  captureThumbnail,
} from "@/lib/face/faceApi";

// Distance below which a face counts as a match. face-api's own default is 0.6;
// 0.5 is a bit stricter to avoid false accepts. Lower = stricter. Tunable.
const FACE_MATCH_THRESHOLD = 0.5;
const STABLE_FRAMES = 2; // same person this many frames before punching
const TICK_MS = 350;
const RESULT_MS = 3200;   // how long to show the punch outcome before returning to idle
const TIMEOUT_MS = 25000; // give up and close the camera if nobody is recognized

// On-demand face recognition. The staff has already tapped IN or OUT (punchType),
// so this opens the camera, recognizes the person once, and calls
// onPunch(staff, thumb, distance, type, opts) for the page to record it. If the
// page returns a `conflict` (e.g. tapped IN but already IN), this shows a
// confirm ("punch OUT instead?") and re-calls onPunch with { force:true }.
// Never auto-punches a passer-by — the camera only runs during a punch session.
export default function FaceKioskScanner({ staffList, punchType, onPunch, onCancel }) {
  const videoRef = useRef(null);
  const faceapiRef = useRef(null);
  const streamRef = useRef(null);
  const matcherRef = useRef(null);
  const staffMapRef = useRef({});
  const busyRef = useRef(false);
  const doneRef = useRef(false); // set once a punch session concludes (stops the loop)
  const lastLabelRef = useRef(null);
  const stableRef = useRef(0);
  const unknownRef = useRef(0);
  const onPunchRef = useRef(onPunch);
  onPunchRef.current = onPunch;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const lastMatchRef = useRef(null); // { staff, thumb, distance } for confirm-switch

  const [phase, setPhase] = useState("loading"); // loading | scanning | error
  const [errorMsg, setErrorMsg] = useState("");
  const [status, setStatus] = useState("searching"); // searching | recognizing | unknown
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [result, setResult] = useState(null); // { pending?, ok?, name, type, message }
  const [timedOut, setTimedOut] = useState(false);
  const [lowLight, setLowLight] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Camera + models.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const faceapi = await loadFaceApi();
        if (cancelled) return;
        faceapiRef.current = faceapi;
        setPhase("scanning");
      } catch (err) {
        console.error("Face kiosk init failed:", err);
        if (!cancelled) {
          setErrorMsg(
            err?.name === "NotAllowedError"
              ? "Camera permission denied. Enable it or use PIN."
              : "Could not start the camera. Use PIN instead."
          );
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  // (Re)build the matcher whenever the enrolled staff set changes.
  useEffect(() => {
    const faceapi = faceapiRef.current;
    if (!faceapi || phase !== "scanning") return;

    const withFace = (staffList || []).filter(
      (s) => Array.isArray(s.faceDescriptors) && s.faceDescriptors.length
    );
    setEnrolledCount(withFace.length);
    staffMapRef.current = Object.fromEntries((staffList || []).map((s) => [s.id, s]));

    if (!withFace.length) {
      matcherRef.current = null;
      return;
    }

    const labeled = withFace
      .map((s) => {
        const descs = s.faceDescriptors
          .map((d) => new Float32Array(d?.data || []))
          .filter((a) => a.length === 128);
        return descs.length ? new faceapi.LabeledFaceDescriptors(s.id, descs) : null;
      })
      .filter(Boolean);

    matcherRef.current = labeled.length
      ? new faceapi.FaceMatcher(labeled, FACE_MATCH_THRESHOLD)
      : null;
  }, [staffList, phase]);

  const confirmMatch = useCallback(async (staff, input, distance) => {
    doneRef.current = true; // stop the loop — one punch per session
    const thumb = captureThumbnail(input, 240); // bigger than the enroll avatar so the log snapshot is legible
    lastMatchRef.current = { staff, thumb, distance };
    const name = `${staff.firstName} ${staff.lastName}`;
    setResult({ pending: true, name });

    let outcome;
    try {
      outcome = await onPunchRef.current(staff, thumb, distance, punchType);
    } catch {
      outcome = { ok: false, message: "Punch failed" };
    }
    setResult({ ...outcome, name });

    // A conflict waits for the user to confirm/cancel, but still auto-closes if
    // they walk away without deciding. A normal result closes quickly.
    setTimeout(() => onCancelRef.current?.(), outcome.conflict ? 12000 : RESULT_MS);
  }, [punchType]);

  // User confirmed the suggested switch (e.g. already IN → punch OUT).
  const handleConfirmSwitch = useCallback(async () => {
    const m = lastMatchRef.current;
    const suggested = result?.suggestedType;
    if (!m || !suggested) return;
    const name = `${m.staff.firstName} ${m.staff.lastName}`;
    setResult({ pending: true, name });
    let outcome;
    try {
      outcome = await onPunchRef.current(m.staff, m.thumb, m.distance, suggested, { force: true });
    } catch {
      outcome = { ok: false, message: "Punch failed" };
    }
    setResult({ ...outcome, name });
    setTimeout(() => onCancelRef.current?.(), RESULT_MS);
  }, [result]);

  // Recognition loop.
  useEffect(() => {
    if (phase !== "scanning") return undefined;
    let active = true;

    const tick = async () => {
      if (!active) return;
      const faceapi = faceapiRef.current;
      const video = videoRef.current;
      const matcher = matcherRef.current;

      if (
        faceapi && matcher && video && video.readyState >= 2 &&
        !busyRef.current && !doneRef.current
      ) {
        busyRef.current = true;
        try {
          const proc = processFrame(video);
          if (proc) setLowLight(proc.luma < 65);
          const res = await detectDescriptor(faceapi, proc?.input || video, 256);
          if (!res) {
            setStatus("searching");
            lastLabelRef.current = null;
            stableRef.current = 0;
          } else {
            const best = matcher.findBestMatch(res.descriptor);
            if (!best || best.label === "unknown") {
              setStatus("unknown");
              unknownRef.current += 1;
              lastLabelRef.current = null;
              stableRef.current = 0;
            } else {
              setStatus("recognizing");
              if (best.label === lastLabelRef.current) {
                stableRef.current += 1;
              } else {
                lastLabelRef.current = best.label;
                stableRef.current = 1;
              }
              if (stableRef.current >= STABLE_FRAMES) {
                const staff = staffMapRef.current[best.label];
                if (staff) await confirmMatch(staff, proc?.input || video, best.distance);
              }
            }
          }
        } catch {
          /* transient */
        } finally {
          busyRef.current = false;
        }
      }
      if (active) setTimeout(tick, TICK_MS);
    };
    tick();
    return () => {
      active = false;
    };
  }, [phase, confirmMatch]);

  // Safety timeout: if nobody is recognized, close the camera automatically.
  useEffect(() => {
    if (phase !== "scanning") return undefined;
    const t = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        setTimedOut(true);
        setTimeout(() => onCancelRef.current?.(), 1800);
      }
    }, TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Result overlay (punch outcome) ──
  const Overlay = () => {
    if (!result) return null;
    if (result.pending) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-3xl">
          <Loader2 size={40} className="animate-spin text-white mb-3" />
          <p className="text-white font-bold text-lg">{result.name}</p>
          <p className="text-white/60 text-sm">Recording punch…</p>
        </div>
      );
    }
    if (result.ok) {
      const isIn = result.type === "in";
      return (
        <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-3xl ${isIn ? "bg-green-500" : "bg-orange-500"}`}>
          <div className="text-6xl mb-2">👋</div>
          <p className="text-black font-black text-2xl">{isIn ? "Welcome!" : "Goodbye!"}</p>
          <p className="text-black/80 font-bold mt-1 flex items-center gap-1.5">
            {isIn ? <LogIn size={18} /> : <LogOut size={18} />}
            {result.name} · {isIn ? "IN" : "OUT"}
          </p>
        </div>
      );
    }
    if (result.conflict) {
      const toOut = result.suggestedType === "out";
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-gray-900/95 px-6 text-center">
          <p className="text-white font-black text-lg">{result.name}</p>
          <p className="text-amber-300 text-sm font-semibold mt-1 mb-5">{result.message}</p>
          <div className="flex flex-col gap-3 w-full max-w-[240px]">
            <button
              onClick={handleConfirmSwitch}
              className={`py-3 rounded-2xl font-black flex items-center justify-center gap-2 ${
                toOut ? "bg-orange-500 text-black hover:bg-orange-400" : "bg-green-500 text-black hover:bg-green-400"
              }`}
            >
              {toOut ? <LogOut size={18} /> : <LogIn size={18} />}
              Yes, punch {toOut ? "OUT" : "IN"}
            </button>
            <button
              onClick={() => onCancelRef.current?.()}
              className="py-3 rounded-2xl font-bold bg-white/10 text-white hover:bg-white/20"
            >
              No, cancel
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 rounded-3xl px-6 text-center">
        <AlertTriangle size={36} className="text-amber-400 mb-2" />
        <p className="text-white font-bold">{result.name}</p>
        <p className="text-amber-300 text-sm mt-1">{result.message}</p>
      </div>
    );
  };

  const isIn = punchType === "in";

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-4">
      {/* Screen fill-light — floods the display white in dim rooms so the tablet
          screen itself lights up the face (browsers can't raise the hardware
          backlight, but a bright screen is the effective equivalent). */}
      {!result && phase === "scanning" && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 z-0"
          style={{
            background:
              "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.75) 30%, rgba(255,255,255,0.25) 52%, rgba(255,255,255,0) 68%)",
            opacity: lowLight ? 1 : 0,
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center w-full">
      {/* Chosen action header */}
      <div className="mb-5">
        <span className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-base font-black tracking-tight ${
          isIn ? "bg-green-500/20 text-green-300" : "bg-orange-500/20 text-orange-300"
        }`}>
          {isIn ? <LogIn size={20} /> : <LogOut size={20} />}
          Punch {isIn ? "IN" : "OUT"} — look at the camera
        </span>
      </div>

      <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden bg-gray-900 border border-white/10 shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />

        {/* Scan guide */}
        {phase === "scanning" && !result && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`w-56 h-64 rounded-[50%] border-4 transition-colors duration-200 ${
                  status === "recognizing" ? "border-green-400" : status === "unknown" ? "border-amber-400" : "border-white/30"
                }`}
              />
            </div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-black/50 text-white flex items-center gap-2">
                {status === "recognizing" ? (
                  <><Check size={16} className="text-green-400" /> Recognizing…</>
                ) : status === "unknown" ? (
                  <><ScanFace size={16} className="text-amber-400" /> Not recognized</>
                ) : (
                  <><ScanFace size={16} className="text-indigo-400 animate-pulse" /> Look at the camera</>
                )}
              </span>
            </div>
          </>
        )}

        {phase === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900/85 text-white/70">
            <Loader2 size={30} className="animate-spin text-indigo-400" />
            <span className="text-sm font-semibold">Starting camera…</span>
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900/90 text-center px-6">
            <AlertTriangle size={30} className="text-amber-400" />
            <span className="text-sm font-semibold text-white/80">{errorMsg}</span>
          </div>
        )}

        {timedOut && !result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900/90 text-center px-6 rounded-3xl">
            <ScanFace size={32} className="text-amber-400" />
            <span className="text-sm font-semibold text-white/80">No face recognized. Try again or use PIN.</span>
          </div>
        )}

        <Overlay />
      </div>

      {/* Status line */}
      <div className="mt-5 text-center">
        {phase === "scanning" && enrolledCount === 0 && (
          <p className="text-amber-300 text-sm font-semibold mb-2">
            No staff have enrolled a face yet — use PIN, or enroll faces in Staff Management.
          </p>
        )}
        {status === "unknown" && unknownRef.current > 4 && enrolledCount > 0 && !result && (
          <p className={`text-sm mb-2 ${lowLight ? "text-gray-700" : "text-white/50"}`}>Face not recognized? Cancel and use your PIN.</p>
        )}
        {lowLight && !result && (
          <p className="text-amber-600 text-xs font-bold mb-2">Low light — the screen brightened to help</p>
        )}

        <button
          onClick={() => onCancelRef.current?.()}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition ${
            lowLight ? "bg-black/10 text-gray-800 hover:bg-black/20" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <KeyRound size={18} /> Cancel
        </button>
      </div>
      </div>
    </div>
  );
}
