/* eslint-disable react/prop-types */
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { useKioskPunchMutation, useGetBranchAttendanceTokensQuery } from "@/lib/redux/api/attendanceApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { Clock, LogIn, LogOut, Camera, Lock, ChevronLeft, Fingerprint, Loader2, ScanFace, User } from "lucide-react";
import { verifyBiometric } from "@/lib/biometricUtils";
import FaceKioskScanner from "./FaceKioskScanner";

// ─── Helpers ────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center select-none">
      <div className="text-6xl md:text-8xl font-black tracking-tight text-white tabular-nums">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
      </div>
      <div className="text-lg md:text-xl text-white/60 font-medium mt-1">
        {now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </div>
    </div>
  );
}

// ─── Admin Exit Modal ───────────────────────────────────────────────────────
function ExitModal({ onExit, onCancel }) {
  const [code, setCode] = useState("");
  const EXIT_CODE = "0000"; // Simple exit code — the admin sets this

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center">
      <div className="bg-gray-900 border border-white/10 rounded-3xl p-8 w-80 text-center">
        <Lock className="mx-auto text-amber-400 mb-4" size={32} />
        <h3 className="text-white font-bold text-lg mb-2">Admin Exit</h3>
        <p className="text-white/50 text-sm mb-6">Enter admin code to exit kiosk</p>
        <input
          type="password"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full text-center text-3xl tracking-[1em] bg-white/10 border border-white/20 rounded-xl py-3 text-white outline-none focus:border-amber-400 transition"
          autoFocus
        />
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition">Cancel</button>
          <button
            onClick={() => { if (code === EXIT_CODE) onExit(); else setCode(""); }}
            className="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition"
          >Unlock</button>
        </div>
      </div>
    </div>
  );
}

// ─── PIN Pad Modal ──────────────────────────────────────────────────────────
function PinPadModal({ staff, onSuccess, onCancel }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const addDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError("");

    if (next.length === 4) {
      // Validate
      if (next === staff.pinCode) {
        setTimeout(() => onSuccess(), 200);
      } else {
        setTimeout(() => {
          setError("Wrong PIN. Try again.");
          setPin("");
        }, 300);
      }
    }
  };

  const backspace = () => {
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  const dots = [0, 1, 2, 3].map((i) => (
    <div
      key={i}
      className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
        i < pin.length
          ? "bg-blue-400 border-blue-400 scale-110"
          : "bg-transparent border-white/30"
      }`}
    />
  ));

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"];

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mx-auto flex items-center justify-center text-white text-2xl font-black mb-4 shadow-lg shadow-blue-500/30">
            {staff.firstName?.[0]}{staff.lastName?.[0]}
          </div>
          <h3 className="text-white font-bold text-xl">{staff.firstName} {staff.lastName}</h3>
          <p className="text-white/50 text-sm mt-1">Enter your 4-digit PIN</p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-4 mb-3">{dots}</div>
        {error && <p className="text-red-400 text-center text-sm font-semibold mb-2 animate-pulse">{error}</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mt-6 max-w-[280px] mx-auto">
          {keys.map((k, i) => {
            if (k === null) return <div key={i} />;
            if (k === "⌫")
              return (
                <button key={i} onClick={backspace} className="aspect-square rounded-2xl bg-white/10 text-white text-xl flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all">
                  <ChevronLeft size={24} />
                </button>
              );
            return (
              <button
                key={i}
                onClick={() => addDigit(String(k))}
                className="aspect-square rounded-2xl bg-white/10 text-white text-2xl font-bold flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all select-none"
              >
                {k}
              </button>
            );
          })}
        </div>

        {/* Cancel & Bio Manual */}
        <div className="flex gap-4 mt-8">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-white/50 font-semibold hover:text-white transition text-sm">
            Cancel
          </button>
          {staff.biometric?.credentialId && (
            <button 
              onClick={onSuccess} // In this context, onSuccess is passed as handlePinSuccess which triggers bio or camera
              className="flex-1 py-3 rounded-xl bg-indigo-600/20 text-indigo-400 font-bold hover:bg-indigo-600/30 transition text-sm flex items-center justify-center gap-2"
            >
              <Fingerprint size={16} /> Use Finger
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Camera Snapshot Modal ──────────────────────────────────────────────────
function CameraModal({ staff, punchType, onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState(null);

  useEffect(() => {
    let activeStream = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      .then((s) => {
        activeStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch(() => {
        // Camera not available — allow without photo
        onCapture(null);
      });

    return () => {
      if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const snap = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.6);
    setCaptured(base64);
    // Stop stream
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }, [stream]);

  return (
    <div className="fixed inset-0 z-[160] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-4">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${punchType === "in" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
            {punchType === "in" ? <LogIn size={16} /> : <LogOut size={16} />}
            Punch {punchType === "in" ? "IN" : "OUT"} — {staff.firstName}
          </span>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-white/10 aspect-[4/3] mb-4">
          {!captured ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <img src={captured} alt="Snapshot" className="w-full h-full object-cover" />
          )}
          {/* Overlay guide */}
          {!captured && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-40 border-2 border-dashed border-white/30 rounded-full" />
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {!captured ? (
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition">Cancel</button>
            <button
              onClick={snap}
              disabled={!ready}
              className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-400 disabled:opacity-30 transition flex items-center justify-center gap-2"
            >
              <Camera size={18} /> Capture
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => setCaptured(null)} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition">Retake</button>
            <button
              onClick={() => onCapture(captured)}
              className={`flex-1 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 ${punchType === "in" ? "bg-green-500 text-black hover:bg-green-400" : "bg-orange-500 text-black hover:bg-orange-400"}`}
            >
              Confirm {punchType === "in" ? "Punch In" : "Punch Out"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Success Toast ──────────────────────────────────────────────────────────
function SuccessToast({ name, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center pointer-events-none">
      <div className={`px-10 py-8 rounded-3xl text-center shadow-2xl animate-bounce pointer-events-auto ${type === "in" ? "bg-green-500" : "bg-orange-500"}`}>
        <div className="text-5xl mb-2">{type === "in" ? "👋" : "👋"}</div>
        <h2 className="text-black font-black text-2xl">{type === "in" ? "Welcome!" : "Goodbye!"}</h2>
        <p className="text-black/70 font-semibold mt-1">{name} punched {type === "in" ? "IN" : "OUT"}</p>
        <p className="text-black/50 text-sm mt-2">{new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN KIOSK PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function KioskPage() {
  const { branchId } = useParams();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  // Keep the tablet screen awake while the kiosk is open (re-acquire when the
  // tab becomes visible again — the lock drops on tab switch / sleep).
  useEffect(() => {
    let lock = null;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* wake lock unsupported or denied — non-critical */
      }
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (lock) lock.release().catch(() => {});
    };
  }, []);

  const companyId = user?.companyId;

  // Fetch staff list
  const { data: staffList = [], isLoading: staffLoading } = useGetStaffListQuery(
    companyId && branchId ? { companyId, branchId } : { skip: true }
  );

  // Fetch today's punches
  const { data: todayPunches = [], refetch: refetchPunches } = useGetBranchAttendanceTokensQuery(
    companyId && branchId ? { companyId, branchId, date: todayStr() } : { skip: true }
  );

  const [kioskPunch] = useKioskPunchMutation();

  // UI state
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showPinPad, setShowPinPad] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [punchType, setPunchType] = useState("in");
  const [toast, setToast] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [verifyingBio, setVerifyingBio] = useState(false);
  const [manualMode, setManualMode] = useState(null); // null | "face" | "grid"
  const [scanType, setScanType] = useState(null); // null (idle) | "in" | "out" — camera opens only after a choice

  // Fetch branch settings
  const { data: settings } = useGetBranchSettingsQuery(
    companyId && branchId ? { companyId, branchId } : { skip: true }
  );
  const attendanceSettings = settings?.attendance || {};
  const faceEnabled = !!attendanceSettings.faceEnabled;

  // Face scanning is the primary flow when enabled; the user can switch to the
  // PIN grid and back. manualMode overrides the default once they choose.
  const showScanner = faceEnabled && (manualMode ?? "face") === "face";

  // Determine punch type for a staff member
  const getPunchType = useCallback(
    (staffId) => {
      const punches = todayPunches
        .filter((p) => p.staffId === staffId)
        .sort((a, b) => {
          const ta = a.timestamp?.seconds || 0;
          const tb = b.timestamp?.seconds || 0;
          return tb - ta;
        });
      if (punches.length === 0) return "in";
      return punches[0].type === "in" ? "out" : "in";
    },
    [todayPunches]
  );

  // Staff selection flow
  const handleStaffSelect = async (staff) => {
    setPunchType(getPunchType(staff.id));
    
    // 1. Check Duplicate Punch Interval
    const lastPunch = todayPunches
      .filter(p => p.staffId === staff.id)
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];

    if (lastPunch && attendanceSettings.duplicatePunchInterval) {
      const lastMs = (lastPunch.timestamp?.seconds || 0) * 1000;
      const nowMs = Date.now();
      const diffMin = (nowMs - lastMs) / 60000;
      if (diffMin < attendanceSettings.duplicatePunchInterval) {
        alert(`Please wait ${Math.ceil(attendanceSettings.duplicatePunchInterval - diffMin)} more minute(s) before punching again.`);
        return;
      }
    }

    // 2. Biometric Verification
    console.log("Kiosk Settings:", attendanceSettings);
    if (attendanceSettings.useBiometrics && staff.biometric?.credentialId) {
      setVerifyingBio(true);
      try {
        const ok = await verifyBiometric(staff.biometric.credentialId);
        if (ok) {
          setSelectedStaff(staff);
          if (attendanceSettings.useCamera) {
            setShowCamera(true);
          } else {
            handleCapture(null, staff); // Immediate punch
          }
          return;
        }
      } catch (err) {
        console.error("Biometric failed:", err);
        // Fallback to PIN
      } finally {
        setVerifyingBio(false);
      }
    }

    // 3. PIN Fallback
    if (!staff.pinCode) {
      alert(`${staff.firstName} does not have a Kiosk PIN configured. Please ask admin to set one.`);
      return;
    }
    setSelectedStaff(staff);
    setShowPinPad(true);
  };

  // After correct PIN
  const handlePinSuccess = () => {
    setShowPinPad(false);
    if (attendanceSettings.useCamera) {
      setShowCamera(true);
    } else {
      handleCapture(null);
    }
  };

  // After capturing photo (or skipping if disabled)
  const handleCapture = async (photoBase64, overrideStaff = null) => {
    const staff = overrideStaff || selectedStaff;
    if (!staff) return;

    setShowCamera(false);

    try {
      await kioskPunch({
        companyId,
        branchId,
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        type: punchType,
        date: todayStr(),
        photoBase64,
      }).unwrap();

      setToast({ name: staff.firstName, type: punchType });
      refetchPunches();
    } catch (err) {
      alert("Punch failed: " + (err?.message || "Unknown error"));
    }

    setSelectedStaff(null);
  };

  // Face-recognition punch. Identity is already verified by the scanner. The
  // staff explicitly tapped IN or OUT (requestedType). Before recording we check
  // their current state: if they tap IN while already IN (or OUT while not in),
  // we DON'T record it — we return a `conflict` so the scanner can ask "you're
  // already IN, punch OUT instead?". Pass opts.force to record the switch.
  // Returns an outcome object (never throws).
  const handleFacePunch = async (staff, thumb, distance, requestedType, opts = {}) => {
    const type = requestedType || getPunchType(staff.id);

    const lastPunch = todayPunches
      .filter((p) => p.staffId === staff.id)
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];
    const currentlyIn = lastPunch?.type === "in";
    const lastTime = lastPunch?.timestamp?.seconds
      ? new Date(lastPunch.timestamp.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;

    // Duplicate-interval guard always applies (prevents rapid repeats).
    if (lastPunch && attendanceSettings.duplicatePunchInterval) {
      const diffMin = (Date.now() - (lastPunch.timestamp?.seconds || 0) * 1000) / 60000;
      if (diffMin < attendanceSettings.duplicatePunchInterval) {
        const wait = Math.ceil(attendanceSettings.duplicatePunchInterval - diffMin);
        return { ok: false, message: `Already punched. Wait ${wait} more min.` };
      }
    }

    // State conflict — ask before recording (unless the user confirmed a switch).
    if (!opts.force) {
      if (type === "in" && currentlyIn) {
        return {
          ok: false,
          conflict: true,
          suggestedType: "out",
          message: lastTime ? `You're already punched IN (since ${lastTime}).` : "You're already punched IN.",
        };
      }
      if (type === "out" && !currentlyIn) {
        return {
          ok: false,
          conflict: true,
          suggestedType: "in",
          message: lastPunch ? `You're already punched OUT.` : "You haven't punched IN yet.",
        };
      }
    }

    try {
      await kioskPunch({
        companyId,
        branchId,
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        type,
        date: todayStr(),
        photoBase64: thumb || null,
        method: "face",
        matchDistance: distance != null ? Number(distance.toFixed(3)) : undefined,
      }).unwrap();

      setToast({ name: staff.firstName, type });
      refetchPunches();
      return { ok: true, type };
    } catch (err) {
      return { ok: false, message: err?.message || "Punch failed" };
    }
  };

  // Admin exit (triple-tap top-left corner)
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const handleCornerTap = () => {
    tapCountRef.current++;
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setShowExitModal(true);
    }
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => (tapCountRef.current = 0), 2000);
  };

  if (!user) return <div className="h-screen bg-gray-950 flex items-center justify-center text-white/40">Loading...</div>;

  return (
    <div className="h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col overflow-hidden select-none">
      {/* Invisible exit trigger — tap top-left 5 times in 2 seconds */}
      <div className="absolute top-0 left-0 w-20 h-20 z-[100]" onClick={handleCornerTap} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Clock className="text-blue-400" size={22} />
          <span className="text-white/60 font-semibold text-sm tracking-wide uppercase">Attendance Kiosk</span>
        </div>
        <LiveClock />
        <div className="text-right">
          <div className="text-white/40 text-xs font-medium">Today&apos;s Punches</div>
          <div className="text-white font-bold text-xl">{todayPunches.length}</div>
        </div>
      </div>

      {/* Primary: Face flow (tap IN/OUT → camera opens → auto-detect), or fallback name grid */}
      {showScanner ? (
        scanType ? (
          <FaceKioskScanner
            staffList={staffList}
            punchType={scanType}
            onPunch={handleFacePunch}
            onCancel={() => setScanType(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 px-4">
            <h2 className="text-white/50 text-sm font-bold uppercase tracking-widest mb-8">
              Tap to punch — then look at the camera
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
              <button
                onClick={() => setScanType("in")}
                className="group flex flex-col items-center justify-center gap-4 py-14 rounded-3xl bg-green-500/10 border-2 border-green-500/30 hover:bg-green-500/20 active:scale-[0.98] transition-all"
              >
                <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-105 transition-transform">
                  <LogIn size={44} className="text-black" />
                </div>
                <span className="text-white font-black text-2xl tracking-tight">PUNCH IN</span>
              </button>
              <button
                onClick={() => setScanType("out")}
                className="group flex flex-col items-center justify-center gap-4 py-14 rounded-3xl bg-orange-500/10 border-2 border-orange-500/30 hover:bg-orange-500/20 active:scale-[0.98] transition-all"
              >
                <div className="w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
                  <LogOut size={44} className="text-black" />
                </div>
                <span className="text-white font-black text-2xl tracking-tight">PUNCH OUT</span>
              </button>
            </div>
            <button
              onClick={() => setManualMode("grid")}
              className="mt-10 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 text-white/70 font-bold hover:bg-white/20 transition"
            >
              <User size={18} /> Use PIN instead
            </button>
          </div>
        )
      ) : (
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-white/40 text-xs font-bold uppercase tracking-widest">Select Your Name</h2>
            {faceEnabled && (
              <button
                onClick={() => setManualMode("face")}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold hover:bg-indigo-500/30 transition"
              >
                <ScanFace size={14} /> Back to Face Scan
              </button>
            )}
          </div>

          {staffLoading ? (
            <div className="text-center text-white/30 py-20">Loading staff...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {staffList.map((s) => {
                const nextPunch = getPunchType(s.id);
                const isPunchedIn = nextPunch === "out";
                return (
                  <button
                    key={s.id}
                    onClick={() => handleStaffSelect(s)}
                    className={`relative flex flex-col items-center p-5 rounded-2xl border transition-all duration-200 active:scale-95 ${
                      isPunchedIn
                        ? "bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-black mb-3 shadow-md ${
                      isPunchedIn
                        ? "bg-gradient-to-br from-green-400 to-emerald-600 text-white"
                        : "bg-gradient-to-br from-gray-600 to-gray-700 text-white/70"
                    }`}>
                      {s.photoUrl ? (
                        <img src={s.photoUrl} alt={s.firstName} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <>{s.firstName?.[0]}{s.lastName?.[0]}</>
                      )}
                    </div>

                    <span className="text-white font-semibold text-sm text-center leading-tight">
                      {s.firstName} {s.lastName?.[0]}.
                    </span>
                    <span className="text-[10px] text-white/40 font-medium mt-1 capitalize">{s.role || "Staff"}</span>

                    {/* Status indicator */}
                    <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${isPunchedIn ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
                    
                    {/* Biometric Icon */}
                    {attendanceSettings.useBiometrics && s.biometric?.credentialId && (
                      <div className="absolute bottom-3 right-3 text-white/20">
                        <Fingerprint size={14} />
                      </div>
                    )}

                    {/* Verifying Overlay */}
                    {verifyingBio && selectedStaff?.id === s.id && (
                      <div className="absolute inset-0 bg-indigo-600/40 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                        <Loader2 className="text-white animate-spin" size={24} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Modals */}
      {showPinPad && selectedStaff && (
        <PinPadModal
          staff={selectedStaff}
          onSuccess={handlePinSuccess}
          onCancel={() => { setShowPinPad(false); setSelectedStaff(null); }}
        />
      )}

      {showCamera && selectedStaff && (
        <CameraModal
          staff={selectedStaff}
          punchType={punchType}
          onCapture={handleCapture}
          onCancel={() => { setShowCamera(false); setSelectedStaff(null); }}
        />
      )}

      {toast && (
        <SuccessToast
          name={toast.name}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      {showExitModal && (
        <ExitModal
          onExit={() => {
            setShowExitModal(false);
            window.location.href = "/";
          }}
          onCancel={() => setShowExitModal(false)}
        />
      )}
    </div>
  );
}
