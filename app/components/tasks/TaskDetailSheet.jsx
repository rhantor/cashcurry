"use client";
// One task, opened (roadmap 4.11): what it is, who gave it and who passed it
// on, and its questions and answers — staff ask here, whoever gave it or
// leads the team answers. A supervisor hands a task given to them on to
// someone in their team from here.
import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Camera, Forward, Repeat, Send, X } from "lucide-react";
import { Avatar, Badge, Button, Select, Sheet, Textarea, cn, toast } from "@/app/components/ui";
import { FileThumb } from "@/app/components/common/Files";
import { timeOf } from "@/lib/chat/model";
import { canHandOver, chainText, repeatText } from "@/lib/tasks/model";
import { addTaskComment, handOver, markTaskRead, useTaskComments } from "@/lib/tasks/client";
import useVoiceRecorder, { canRecordVoice } from "@/app/hooks/useVoiceRecorder";
import { MicButton, RecordingBar, VoicePlayer } from "@/app/components/common/Voice";

const dayText = (d) => format(parseISO(d), "EEE d MMM");
const when = (t) => {
  const ms = timeOf(t);
  return ms ? format(new Date(ms), "d MMM, h:mm a") : "";
};

/** team: who a supervisor can hand it to [{ uid, name, role }]. */
export default function TaskDetailSheet({ task, onClose, companyId, branchId, user, team = [] }) {
  const { list: comments, loading } = useTaskComments(companyId, branchId, task?.id);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [passTo, setPassTo] = useState("");
  const end = useRef(null);
  const voice = useVoiceRecorder();
  const [canVoice, setCanVoice] = useState(false);
  useEffect(() => setCanVoice(canRecordVoice()), []);
  useEffect(() => {
    if (voice.state === "denied") toast.error("No microphone", { description: "Allow the microphone for this app in your phone or browser settings, then try again." });
  }, [voice.state]);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [comments.length]);
  // opened (and each new message while open): seen — the badge and the bell's notes go
  useEffect(() => {
    if (task?.id && user?.uid) markTaskRead(companyId, user.uid, task.id).catch(() => {});
  }, [task?.id, task?.commentCount, companyId, user?.uid]);
  if (!task) return <Sheet open={false} onClose={onClose} />;

  const sendVoice = async (rec) => {
    if (!rec) return;
    setBusy(true);
    try {
      await addTaskComment(companyId, branchId, task, user, { voice: rec });
    } catch (e) {
      toast.error("Couldn't send the voice message", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    setBusy(true);
    try {
      await addTaskComment(companyId, branchId, task, user, { text, files });
      setText("");
      setFiles([]);
    } catch (e) {
      toast.error("Couldn't send", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  const pass = async () => {
    const person = team.find((p) => p.uid === passTo);
    if (!person) return;
    setBusy(true);
    try {
      await handOver(companyId, branchId, task, user, person);
      toast.success(`Handed over to ${person.name.split(" ")[0]}`);
      onClose();
    } catch (e) {
      toast.error("Couldn't hand it over", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  const handing = canHandOver(task, user) && team.length > 0;

  return (
    <Sheet open onClose={onClose} title={task.title} description={chainText(task)} size="lg">
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {task.repeat ? (
              <span className="inline-flex items-center gap-1"><Repeat className="size-3.5" />{repeatText(task)}</span>
            ) : (
              <span>{task.dueDate ? `By ${dayText(task.dueDate)}` : "Once, any time"}</span>
            )}
            {task.priority === "urgent" && <Badge tone="danger" className="px-2 py-px text-[10px]">Urgent</Badge>}
            {task.needsPhoto && <Badge className="px-2 py-px text-[10px]"><Camera className="size-3" />Photo needed</Badge>}
            {task.status === "done" && <Badge tone="success" className="px-2 py-px text-[10px]">Done</Badge>}
          </div>
          {task.details && <p className="whitespace-pre-line rounded-xl bg-surface-2 px-3 py-2 text-sm text-fg">{task.details}</p>}
        </div>

        {handing && (
          <div className="space-y-2 rounded-2xl border border-brand/30 bg-brand-soft/40 p-3">
            <p className="text-sm font-semibold text-fg">Hand it to your team</p>
            <p className="text-xs text-muted">They do it; you stay in charge and see how it goes.</p>
            <div className="flex gap-2">
              <Select value={passTo} onChange={(e) => setPassTo(e.target.value)} aria-label="Hand to" className="flex-1">
                <option value="">Choose a person…</option>
                {team.map((p) => <option key={p.uid} value={p.uid}>{p.name}</option>)}
              </Select>
              <Button icon={Forward} onClick={pass} disabled={!passTo} loading={busy}>Hand over</Button>
            </div>
          </div>
        )}

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Questions & answers</h3>
          {loading ? null : !comments.length ? (
            <p className="text-sm text-muted">No questions yet. Ask here — whoever gave the task gets it.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => {
                const me = c.byUid === user.uid;
                return (
                  <li key={c.id} className={cn("flex gap-2", me && "flex-row-reverse")}>
                    <Avatar name={c.byName} size="sm" />
                    <div className={cn("max-w-[80%] space-y-1 rounded-2xl px-3 py-2", me ? "bg-brand-soft" : "bg-surface-2")}>
                      <p className="text-[11px] text-muted">{me ? "You" : c.byName} · {when(c.createdAt)}</p>
                      {c.text && <p className="whitespace-pre-line text-sm text-fg">{c.text}</p>}
                      {c.voice?.url && <VoicePlayer url={c.voice.url} duration={c.voice.duration} className={me ? "bg-surface/70" : "bg-surface"} />}
                      {c.photos?.length > 0 && <div className="flex flex-wrap gap-1.5">{c.photos.map((u) => <FileThumb key={u} url={u} label="Photo" className="size-16" />)}</div>}
                    </div>
                  </li>
                );
              })}
              <li ref={end} />
            </ul>
          )}
          <div className="space-y-2">
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((url, i) => (
                  <div key={url} className="relative size-14 overflow-hidden rounded-lg border border-line">
                    <img src={url} alt="" className="size-full object-cover" />
                    <button type="button" aria-label="Remove" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {voice.state === "recording" ? (
              <div className="rounded-2xl border border-line">
                <RecordingBar seconds={voice.seconds} level={voice.level} busy={busy} onCancel={voice.cancel} onSend={async () => sendVoice(await voice.stop())} />
              </div>
            ) : (
            <div className="flex items-end gap-2">
              <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line text-muted hover:bg-surface-2" aria-label="Add a photo">
                <Camera className="size-4" />
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const p = [...(e.target.files || [])]; e.target.value = ""; setFiles((l) => [...l, ...p].slice(0, 4)); }} />
              </label>
              <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or answer…" aria-label="Message" className="min-h-10 flex-1" />
              {!text.trim() && !files.length && canVoice ? (
                <MicButton
                  onClick={async () => {
                    await voice.start();
                    voice.onLimit(sendVoice);
                  }}
                  disabled={busy}
                  label="Ask by voice"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg hover:bg-brand-hover disabled:opacity-50"
                />
              ) : (
                <Button icon={Send} onClick={send} loading={busy} disabled={!text.trim() && !files.length} aria-label="Send" />
              )}
            </div>
            )}
          </div>
        </section>
      </div>
    </Sheet>
  );
}
