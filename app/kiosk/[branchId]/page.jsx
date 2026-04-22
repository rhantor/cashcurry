"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { useKioskPunchMutation, useGetBranchAttendanceTokensQuery } from "@/lib/redux/api/attendanceApiSlice";
import { Clock, LogIn, LogOut, X, Camera, Lock, ChevronLeft, User } from "lucide-react";

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

        {/* Cancel */}
        <button onClick={onCancel} className="mt-8 w-full py-3 rounded-xl text-white/50 font-semibold hover:text-white transition text-sm">
          Cancel
        </button>
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
  const handleStaffSelect = (staff) => {
    if (!staff.pinCode) {
      alert(`${staff.firstName} does not have a Kiosk PIN configured. Please ask admin to set one.`);
      return;
    }
    setSelectedStaff(staff);
    setPunchType(getPunchType(staff.id));
    setShowPinPad(true);
  };

  // After correct PIN
  const handlePinSuccess = () => {
    setShowPinPad(false);
    setShowCamera(true);
  };

  // After capturing photo
  const handleCapture = async (photoBase64) => {
    setShowCamera(false);

    try {
      await kioskPunch({
        companyId,
        branchId,
        staffId: selectedStaff.id,
        staffName: `${selectedStaff.firstName} ${selectedStaff.lastName}`,
        type: punchType,
        date: todayStr(),
        photoBase64,
      }).unwrap();

      setToast({ name: selectedStaff.firstName, type: punchType });
      refetchPunches();
    } catch (err) {
      alert("Punch failed: " + (err?.message || "Unknown error"));
    }

    setSelectedStaff(null);
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

      {/* Staff Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4 px-2">Select Your Name</h2>

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
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
