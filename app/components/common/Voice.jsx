"use client";
// Voice messages (chat, task questions): the bar shown while recording, and a
// player for a saved one — play / pause, a bar to jump along, the time.
import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, SendHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/app/components/ui";
import { MAX_VOICE_SECONDS, clock } from "@/app/hooks/useVoiceRecorder";

/** While recording: a red dot, the clock and a meter; throw away or send. */
export function RecordingBar({ seconds, level, onCancel, onSend, busy }) {
  const bars = 18;
  return (
    <div className="flex min-h-12 flex-1 items-center gap-2 px-1.5 py-1.5" role="status" aria-live="polite">
      <button type="button" onClick={onCancel} aria-label="Throw away the recording" className="flex size-9 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger-soft">
        <Trash2 className="size-5" />
      </button>
      <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-danger" aria-hidden="true" />
      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-fg">{clock(seconds)}</span>
      <span className="flex h-6 min-w-0 flex-1 items-center gap-0.5 overflow-hidden" aria-hidden="true">
        {Array.from({ length: bars }, (_, i) => {
          const wobble = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 1.7 + seconds));
          return <span key={i} className="w-1 rounded-full bg-brand/70 transition-[height] duration-100" style={{ height: `${Math.max(12, Math.round(level * wobble * 100))}%` }} />;
        })}
      </span>
      <span className="hidden text-[10px] text-subtle sm:inline">up to {clock(MAX_VOICE_SECONDS)}</span>
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        aria-label="Send the voice message"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand/80 text-white shadow-md active:scale-95 disabled:opacity-60"
      >
        {busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <SendHorizontal className="size-[18px]" />}
      </button>
    </div>
  );
}

/** The 🎤 button that starts a recording. */
export function MicButton({ onClick, disabled, className, label = "Record a voice message" }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={className}>
      <Mic className="size-[18px]" />
    </button>
  );
}

/** A saved voice message. `mine`: on your own (coloured) chat bubble. */
export function VoicePlayer({ url, duration = 0, mine = false, className }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(duration);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const seek = (e) => {
    const a = audio.current;
    const total = length || a?.duration;
    if (!a || !total || !isFinite(total)) return;
    const box = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * total;
  };
  const pct = length ? Math.min(100, (at / length) * 100) : 0;
  return (
    <div className={cn("flex min-w-52 items-center gap-2.5 rounded-xl px-2 py-1.5", mine ? "bg-white/15" : "bg-surface-2", className)}>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0 && setLength(e.currentTarget.duration)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play voice message"}
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", mine ? "bg-white text-brand" : "bg-brand text-brand-fg")}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <div role="slider" aria-label="Position" aria-valuemin={0} aria-valuemax={Math.round(length)} aria-valuenow={Math.round(at)} tabIndex={0} onClick={seek} className="relative h-1.5 cursor-pointer rounded-full bg-current/20">
          <span className={cn("absolute inset-y-0 left-0 rounded-full", mine ? "bg-white" : "bg-brand")} style={{ width: `${pct}%` }} />
        </div>
        <p className={cn("flex items-center gap-1 text-[11px] tabular-nums", mine ? "text-white/80" : "text-muted")}>
          <Mic className="size-3" aria-hidden="true" />
          {playing || at ? clock(at) : clock(length)}
        </p>
      </div>
    </div>
  );
}
