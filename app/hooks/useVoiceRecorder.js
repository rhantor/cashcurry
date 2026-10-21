"use client";
// Record a voice message in the browser (chat, task questions): the
// microphone, a running clock, how loud it is (for a small meter), and a file
// at the end. MP4/AAC where the browser can make it — it plays on iPhone and
// Android alike — else WebM/Opus or Ogg.
import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_VOICE_SECONDS = 5 * 60;
const TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

const pickType = () => (typeof MediaRecorder === "undefined" ? null : TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) || "");
const extOf = (type) => (type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm");

/** Can this browser record at all? */
export const canRecordVoice = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/**
 * Why it can't, in words — or null when it can. Browsers turn the microphone
 * off on a plain http:// address (other than localhost): the live app is
 * https, but a phone testing the dev server over Wi-Fi isn't.
 */
export function whyNoVoice() {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) return { title: "Voice needs a secure address", description: "This address starts with http://, so the browser keeps the microphone off. It works in the live app (https). To try it here, open the app on this computer at localhost." };
  if (!canRecordVoice()) return { title: "Voice isn't available here", description: "This browser can't record. Try Chrome, or the Cash Curry app." };
  return null;
}

/**
 * { state: "idle" | "recording" | "denied" | "unavailable", seconds, level (0–1), start(), stop() → { file, duration } | null, cancel() }
 */
export default function useVoiceRecorder() {
  const [state, setState] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const rec = useRef(null); // { recorder, stream, chunks, started, ctx, raf, timer, resolve }

  const cleanup = useCallback(() => {
    const r = rec.current;
    if (!r) return;
    clearInterval(r.timer);
    cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.ctx?.close().catch(() => {});
    rec.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const finish = useCallback(
    (keep) =>
      new Promise((resolve) => {
        const r = rec.current;
        if (!r) return resolve(null);
        r.recorder.onstop = () => {
          const duration = Math.max(1, Math.round((Date.now() - r.started) / 1000));
          const type = (r.recorder.mimeType || r.type || "audio/webm").split(";")[0];
          const blob = new Blob(r.chunks, { type });
          cleanup();
          setState("idle");
          setSeconds(0);
          if (!keep || !blob.size) return resolve(null);
          const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
          resolve({ file: new File([blob], `Voice message ${stamp}.${extOf(type)}`, { type }), duration });
        };
        if (r.recorder.state !== "inactive") r.recorder.stop();
        else r.recorder.onstop();
      }),
    [cleanup]
  );

  const stop = useCallback(() => finish(true), [finish]);
  const cancel = useCallback(() => finish(false), [finish]);

  const start = useCallback(async () => {
    if (rec.current) return;
    // say why (the page shows a message on this state), then be ready to try again
    const fail = (why) => {
      setState(why);
      setTimeout(() => setState("idle"), 200);
    };
    if (!canRecordVoice()) return fail("unavailable");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return fail("denied");
    }
    const type = pickType();
    const recorder = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined);
    const r = { recorder, stream, chunks: [], started: Date.now(), type };
    recorder.ondataavailable = (e) => e.data?.size && r.chunks.push(e.data);
    recorder.start(250);
    // a small loudness meter
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      r.ctx = new Ctx();
      const analyser = r.ctx.createAnalyser();
      analyser.fftSize = 256;
      r.ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 64));
        r.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* no meter — recording still works */
    }
    r.timer = setInterval(() => {
      const s = Math.floor((Date.now() - r.started) / 1000);
      setSeconds(s);
      if (s >= MAX_VOICE_SECONDS) finish(true).then((v) => r.onLimit?.(v));
    }, 250);
    rec.current = r;
    setSeconds(0);
    setState("recording");
  }, [finish]);

  /** Called with the recording if it reaches the 5-minute limit by itself. */
  const onLimit = useCallback((fn) => {
    if (rec.current) rec.current.onLimit = fn;
  }, []);

  return { state, seconds, level, start, stop, cancel, onLimit };
}

/** 75 → "1:15" */
export const clock = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, "0")}`;
