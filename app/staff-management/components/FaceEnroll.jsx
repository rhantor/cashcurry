/* eslint-disable react/prop-types */
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X, Loader2, ScanFace, AlertTriangle, Check,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, User,
} from "lucide-react";
import {
  loadFaceApi,
  detectLandmarks,
  estimatePose,
  detectDescriptor,
  descriptorToArray,
  captureThumbnail,
  processFrame,
  findDuplicateEnrollment,
} from "@/lib/face/faceApi";

// Guided head-pose steps. "center" calibrates the per-person baseline; the rest
// are tested as deltas from it. Flip YAW_SIGN if left/right feel inverted on the
// device (front-camera mirroring differs by browser).
const YAW_SIGN = 1;
const YAW_TH = 0.14;   // how far to turn before it counts
const PITCH_TH = 0.12; // how far to tilt before it counts
const HOLD_TICKS = 2;  // consecutive matching frames before auto-capturing

const STEPS = [
  { key: "center", label: "Look straight ahead", Icon: User, test: () => true, calibrate: true },
  { key: "left",   label: "Slowly turn your head LEFT",  Icon: ArrowLeft,  test: (dy) => dy * YAW_SIGN > YAW_TH },
  { key: "right",  label: "Now turn your head RIGHT",    Icon: ArrowRight, test: (dy) => dy * YAW_SIGN < -YAW_TH },
  { key: "up",     label: "Tilt your head UP",           Icon: ArrowUp,    test: (dy, dp) => dp < -PITCH_TH },
  { key: "down",   label: "Tilt your head DOWN",         Icon: ArrowDown,  test: (dy, dp) => dp > PITCH_TH },
];

const RING = 240; // px
const R = 110;
const CIRC = 2 * Math.PI * R;

// Auto-capturing face enrollment. Streams the camera, walks the user through
// head poses, and captures a descriptor at each pose automatically as a
// progress ring fills to 100%. Hands the parent { descriptors, thumb }.
//
// `enrolledFaces` — [{ id, name, descriptors }] for every OTHER staff member
// with a face on file. Enrolling a face that already belongs to one of them is
// refused: it would let that person punch in under two names.
export default function FaceEnroll({ staffName, enrolledFaces = [], onEnrolled, onClose }) {
  const videoRef = useRef(null);
  const faceapiRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const baselineRef = useRef(null); // { yaw, pitch }
  const holdRef = useRef(0);
  const capturingRef = useRef(false);

  const [phase, setPhase] = useState("loading"); // loading | scanning | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [facePresent, setFacePresent] = useState(false);
  const [poseOk, setPoseOk] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [lowLight, setLowLight] = useState(false);

  const capturedRef = useRef([]); // number[][]
  const thumbRef = useRef(null);
  const stepIdxRef = useRef(0);
  stepIdxRef.current = stepIdx;

  const total = STEPS.length;
  const pct = Math.min(100, Math.round((stepIdx / total) * 100));

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Init camera + models.
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
        console.error("Face enroll init failed:", err);
        if (!cancelled) {
          setErrorMsg(
            err?.name === "NotAllowedError"
              ? "Camera permission denied. Allow camera access and try again."
              : "Could not start the camera or load face models."
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

  const finish = useCallback(() => {
    setPhase("done");
    stopStream();
    // brief success flash, then hand back
    setTimeout(() => {
      onEnrolled({ descriptors: capturedRef.current, thumb: thumbRef.current });
    }, 700);
  }, [onEnrolled, stopStream]);

  // Someone else already owns this face — stop the whole enrollment.
  const rejectDuplicate = useCallback((dupe) => {
    capturedRef.current = [];
    thumbRef.current = null;
    stopStream();
    setErrorMsg(
      `This face is already enrolled as ${dupe.name}. One face can only belong ` +
      `to one staff member — remove it from ${dupe.name} first if this is the ` +
      `same person.`
    );
    setPhase("error");
  }, [stopStream]);

  // Capture a descriptor for the current step, then advance.
  const captureStep = useCallback(async (step) => {
    const faceapi = faceapiRef.current;
    const video = videoRef.current;
    if (!faceapi || !video || capturingRef.current) return;
    capturingRef.current = true;
    try {
      const proc = processFrame(video);
      const input = proc?.input || video;
      const res = await detectDescriptor(faceapi, input);
      if (!res) return; // lost the face mid-capture; loop will retry

      // Checked on every capture, so a swap mid-enrollment can't slip through
      // either. The first (center) capture makes it fail fast.
      const descriptor = descriptorToArray(res.descriptor);
      const dupe = findDuplicateEnrollment(descriptor, enrolledFaces);
      if (dupe) {
        rejectDuplicate(dupe);
        return;
      }

      capturedRef.current = [...capturedRef.current, descriptor];
      if (step.key === "center") thumbRef.current = captureThumbnail(input);

      holdRef.current = 0;
      const next = stepIdxRef.current + 1;
      setStepIdx(next);
      setPoseOk(false);
      if (next >= total) finish();
    } catch (err) {
      console.error("Capture failed:", err);
    } finally {
      capturingRef.current = false;
    }
  }, [finish, total, enrolledFaces, rejectDuplicate]);

  // Live pose loop.
  useEffect(() => {
    if (phase !== "scanning") return undefined;
    let active = true;

    const tick = async () => {
      if (!active) return;
      const faceapi = faceapiRef.current;
      const video = videoRef.current;
      const step = STEPS[stepIdxRef.current];

      if (faceapi && step && video && video.readyState >= 2 && !busyRef.current && !capturingRef.current) {
        busyRef.current = true;
        try {
          const proc = processFrame(video);
          if (proc) setLowLight(proc.luma < 65);
          const det = await detectLandmarks(faceapi, proc?.input || video);
          if (!det) {
            setFacePresent(false);
            setPoseOk(false);
            holdRef.current = 0;
          } else {
            setFacePresent(true);
            const pose = estimatePose(det.landmarks);

            if (step.calibrate) {
              // Center: accept a steady frontal face, set the baseline.
              holdRef.current += 1;
              setPoseOk(true);
              if (holdRef.current >= HOLD_TICKS) {
                baselineRef.current = pose;
                await captureStep(step);
              }
            } else {
              const base = baselineRef.current || { yaw: 0, pitch: 0 };
              const dy = pose.yaw - base.yaw;
              const dp = pose.pitch - base.pitch;
              const ok = step.test(dy, dp);
              setPoseOk(ok);
              if (ok) {
                holdRef.current += 1;
                if (holdRef.current >= HOLD_TICKS) await captureStep(step);
              } else {
                holdRef.current = 0;
              }
            }
          }
        } catch {
          /* transient */
        } finally {
          busyRef.current = false;
        }
      }
      if (active) setTimeout(tick, 220);
    };
    tick();
    return () => { active = false; };
  }, [phase, captureStep]);

  const step = STEPS[Math.min(stepIdx, total - 1)];
  const StepIcon = step.Icon;

  return (
    <div className="fixed inset-0 z-[160] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-white">
            <ScanFace size={20} className="text-indigo-400" />
            <h3 className="font-bold text-lg">Face ID Enrollment</h3>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition">
            <X size={20} />
          </button>
        </div>
        {staffName && <p className="text-white/50 text-sm mb-4">Enrolling {staffName}</p>}

        {/* Camera + progress ring */}
        <div className="relative mx-auto mb-5" style={{ width: RING, height: RING }}>
          {/* Screen fill-light — a white halo that throws light on the face in
              dim rooms (brighter when low light is detected). */}
          <div
            className="absolute rounded-full pointer-events-none transition-opacity duration-500"
            style={{
              inset: -28,
              background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0) 72%)",
              opacity: lowLight ? 0.9 : 0.12,
            }}
          />
          {/* Circular video mask */}
          <div className="absolute inset-3 rounded-full overflow-hidden bg-gray-900 border border-white/10">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
            {phase === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900/80 text-white/70">
                <Loader2 size={26} className="animate-spin text-indigo-400" />
                <span className="text-xs font-semibold">Loading…</span>
              </div>
            )}
            {phase === "done" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-green-500/90 text-black">
                <Check size={40} />
                <span className="text-sm font-black">Enrolled!</span>
              </div>
            )}
          </div>

          {/* Progress ring */}
          <svg width={RING} height={RING} className="absolute inset-0 -rotate-90">
            <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
            <circle
              cx={RING / 2} cy={RING / 2} r={R} fill="none"
              stroke={poseOk || phase === "done" ? "#34d399" : "#818cf8"}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - (phase === "done" ? 1 : stepIdx / total))}
              style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.2s" }}
            />
          </svg>
        </div>

        {phase === "error" ? (
          <div className="text-center">
            <div className="flex flex-col items-center gap-3 mb-5 text-white/80">
              <AlertTriangle size={28} className="text-amber-400" />
              <span className="text-sm font-semibold">{errorMsg}</span>
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition">
              Close
            </button>
          </div>
        ) : phase === "done" ? (
          <p className="text-center text-green-400 font-bold">Face ID saved · 100%</p>
        ) : (
          <>
            {/* Step instruction */}
            <div className="text-center mb-2">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-colors ${
                poseOk ? "bg-green-500/20 text-green-300" : "bg-indigo-500/20 text-indigo-200"
              }`}>
                <StepIcon size={18} />
                {step.label}
              </div>
            </div>

            <p className="text-center text-white/40 text-xs mb-3">
              {!facePresent
                ? "Position your face inside the circle"
                : poseOk
                ? "Hold still…"
                : "Follow the prompt above"}
              <span className="mx-2">·</span>
              {pct}%
            </p>

            {lowLight && (
              <p className="text-center text-amber-300 text-xs font-semibold mb-3">
                Low light — face a window or lamp for a clearer scan
              </p>
            )}

            {/* Step dots */}
            <div className="flex items-center justify-center gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s.key}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i < stepIdx ? "bg-green-400" : i === stepIdx ? "bg-indigo-400 scale-125" : "bg-white/20"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
