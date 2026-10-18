"use client";
// One issue: what's wrong, its photos, who raised it and who has it, and
// the buttons this person may use — give it to someone, urgent or not, a
// due date, start, resolve (with a note), reopen, delete. Underneath, its
// discussion: comments with photos, and a line for every change.
import { useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Camera, CheckCircle2, Flag, Play, RotateCcw, SendHorizontal, Trash2, UserPlus, X } from "lucide-react";
import { Avatar, Badge, Button, DatePicker, Menu, Sheet, cn, confirmDialog, promptDialog, toast } from "@/app/components/ui";
import { roleLabel } from "@/lib/authz/permissions";
import { STATUSES, categoryOf, isOverdue, issueActions } from "@/lib/issues/model";
import { addComment, assignIssue, deleteIssue, reopenIssue, resolveIssue, setDueDate, setPriority, startIssue } from "@/lib/issues/client";
import { timeOf } from "@/lib/chat/model";
import { useBusinessToday } from "@/app/hooks/useRegion";
import PhotoViewer from "@/app/components/chat/PhotoViewer";
import { useIssueComments } from "./useIssues";

const ago = (t) => (t ? formatDistanceToNowStrict(new Date(t), { addSuffix: true }) : "");

function Photos({ photos, onOpen, small }) {
  if (!photos?.length) return null;
  return (
    <div className={cn("grid gap-1.5", small ? "grid-cols-4" : photos.length > 1 ? "grid-cols-3" : "grid-cols-1")}>
      {photos.map((p, i) => (
        <button key={p.path || p.url} type="button" onClick={() => onOpen(photos, i)} className="overflow-hidden rounded-xl bg-surface-2">
          <img src={p.url} alt={p.name} loading="lazy" className={cn("w-full object-cover", small || photos.length > 1 ? "aspect-square" : "max-h-72")} />
        </button>
      ))}
    </div>
  );
}

export default function IssueSheet({ issue, onClose, user, people = [], branchName }) {
  const today = useBusinessToday();
  const companyId = user.companyId;
  const branchId = issue?.branchId;
  const comments = useIssueComments(companyId, branchId, issue?.id);
  const [viewer, setViewer] = useState(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState("");
  const picker = useRef(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  if (!issue) return null;

  const can = issueActions(issue, user);
  const st = STATUSES[issue.status] || STATUSES.open;
  const cat = categoryOf(issue.category);
  const team = people.filter((p) => p.branchId === branchId || !p.branchId);
  const run = async (key, fn, done) => {
    setBusy(key);
    try {
      await fn();
      if (done) toast.success(done);
    } catch (e) {
      toast.error("Couldn't save that", { description: e?.message });
    } finally {
      setBusy("");
    }
  };

  const send = () =>
    run("comment", async () => {
      await addComment(companyId, branchId, issue, user, { text, photos: files });
      setText("");
      setFiles([]);
    });

  return (
    <Sheet open={!!issue} onClose={onClose} title={issue.title} description={`${cat.emoji} ${cat.label}${branchName ? ` · ${branchName}` : ""}`}>
      <div className="space-y-4">
        {/* where it stands */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={st.tone}>{st.label}</Badge>
          {issue.priority === "urgent" && (
            <Badge tone="danger">
              <Flag className="size-3" /> Urgent
            </Badge>
          )}
          {isOverdue(issue, today) && <Badge tone="danger">Overdue</Badge>}
          {issue.dueDate && !isOverdue(issue, today) && issue.status !== "resolved" && <Badge tone="neutral">Due {issue.dueDate}</Badge>}
        </div>

        <Photos photos={issue.photos} onOpen={(list, start) => setViewer({ list, start })} />
        {issue.details && <p className="whitespace-pre-wrap text-sm text-fg">{issue.details}</p>}

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-3 text-xs">
          <div>
            <dt className="text-subtle">Reported by</dt>
            <dd className="font-semibold text-fg">{issue.reportedBy?.name || "—"}</dd>
            <dd className="text-muted">{ago(timeOf(issue.createdAt))}</dd>
          </div>
          <div>
            <dt className="text-subtle">Who has it</dt>
            <dd className="font-semibold text-fg">{issue.assignedTo?.name || "No one yet"}</dd>
            {issue.assignedTo?.role && <dd className="text-muted">{roleLabel(issue.assignedTo.role)}</dd>}
          </div>
          {issue.status === "resolved" && (
            <div className="col-span-2">
              <dt className="text-subtle">Resolved by</dt>
              <dd className="font-semibold text-fg">
                {issue.resolvedBy?.name} <span className="font-normal text-muted">{ago(timeOf(issue.resolvedAt))}</span>
              </dd>
              {issue.resolution && <dd className="mt-0.5 text-muted">“{issue.resolution}”</dd>}
            </div>
          )}
        </dl>

        {/* what this person may do */}
        <div className="flex flex-wrap gap-2">
          {can.includes("start") && (
            <Button size="sm" icon={Play} loading={busy === "start"} onClick={() => run("start", () => startIssue(companyId, branchId, issue, user), "Started")}>
              Start
            </Button>
          )}
          {can.includes("resolve") && (
            <Button
              size="sm"
              icon={CheckCircle2}
              loading={busy === "resolve"}
              onClick={async () => {
                const note = await promptDialog({ title: "Mark resolved?", label: "What was done (optional)", placeholder: "e.g. Replaced the thermostat", confirmLabel: "Resolved" });
                if (note === null) return;
                run("resolve", () => resolveIssue(companyId, branchId, issue, user, note), "Marked resolved");
              }}
            >
              Resolve
            </Button>
          )}
          {can.includes("reopen") && (
            <Button
              size="sm"
              variant="secondary"
              icon={RotateCcw}
              loading={busy === "reopen"}
              onClick={async () => {
                const note = await promptDialog({ title: "Reopen this issue?", label: "Why (optional)", placeholder: "e.g. It broke again", confirmLabel: "Reopen" });
                if (note === null) return;
                run("reopen", () => reopenIssue(companyId, branchId, issue, user, note), "Reopened");
              }}
            >
              Reopen
            </Button>
          )}
          {can.includes("assign") && (
            <Menu
              width={240}
              items={[
                ...team.map((p) => ({ label: `${p.name} · ${roleLabel(p.role)}`, onSelect: () => run("assign", () => assignIssue(companyId, branchId, issue, user, p), `Given to ${p.name}`) })),
                ...(issue.assignedTo ? ["divider", { label: "Take it off them", onSelect: () => run("assign", () => assignIssue(companyId, branchId, issue, user, null)) }] : []),
              ]}
              trigger={(p) => (
                <Button {...p} size="sm" variant="secondary" icon={UserPlus} loading={busy === "assign"}>
                  {issue.assignedTo ? "Give to someone else" : "Give to someone"}
                </Button>
              )}
            />
          )}
          {can.includes("priority") && (
            <Button size="sm" variant="secondary" icon={Flag} className={issue.priority === "urgent" ? "text-danger" : ""} onClick={() => run("priority", () => setPriority(companyId, branchId, issue, user, issue.priority === "urgent" ? "normal" : "urgent"))}>
              {issue.priority === "urgent" ? "Not urgent" : "Urgent"}
            </Button>
          )}
          {can.includes("due") && (
            <div className="w-40">
              <DatePicker size="sm" value={issue.dueDate || ""} onChange={(d) => run("due", () => setDueDate(companyId, branchId, issue, user, d))} placeholder="Fix by…" />
            </div>
          )}
          {can.includes("delete") && (
            <Button
              size="sm"
              variant="secondary"
              icon={Trash2}
              className="text-danger"
              onClick={async () => {
                if (!(await confirmDialog({ title: "Delete this issue?", message: "It goes for everyone, with its discussion.", confirmLabel: "Delete", danger: true }))) return;
                run("delete", async () => {
                  await deleteIssue(companyId, branchId, issue);
                  onClose();
                }, "Issue deleted");
              }}
            >
              Delete
            </Button>
          )}
        </div>

        {/* the discussion */}
        <div className="border-t border-line pt-4">
          <p className="mb-3 text-sm font-bold text-fg">Discussion</p>
          <ol className="space-y-3">
            {comments.map((c) =>
              c.kind === "event" ? (
                <li key={c.id} className="flex items-center gap-2 text-xs text-muted">
                  <span className="size-1.5 shrink-0 rounded-full bg-line" />
                  <span className="flex-1">{c.text}</span>
                  <span className="shrink-0 text-subtle">{ago(timeOf(c.createdAt))}</span>
                </li>
              ) : (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar name={c.byName} size="sm" />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-surface-2 px-3 py-2">
                    <p className="flex items-baseline gap-2 text-xs">
                      <span className="font-semibold text-fg">{c.byName}</span>
                      <span className="text-subtle">{ago(timeOf(c.createdAt))}</span>
                    </p>
                    {c.text && <p className="mt-0.5 whitespace-pre-wrap text-sm text-fg">{c.text}</p>}
                    {c.photos?.length > 0 && (
                      <div className="mt-1.5">
                        <Photos small photos={c.photos} onOpen={(list, start) => setViewer({ list, start })} />
                      </div>
                    )}
                  </div>
                </li>
              )
            )}
            {!comments.length && <li className="text-xs text-muted">No comments yet.</li>}
          </ol>

          {/* add to it */}
          <div className="mt-3 rounded-2xl bg-surface-2 p-2">
            {files.length > 0 && (
              <div className="mb-2 flex gap-2 px-1 pt-1">
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={previews[i]} alt={f.name} className="size-14 rounded-lg object-cover" />
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, n) => n !== i))} className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-fg text-surface">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-1">
              <button type="button" aria-label="Add a photo" onClick={() => picker.current?.click()} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-brand">
                <Camera className="size-5" />
              </button>
              <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(e) => {
                  const picked = [...(e.target.files || [])].filter((f) => f.type.startsWith("image/"));
                  e.target.value = "";
                  setFiles((x) => [...x, ...picked].slice(0, 6));
                }} />
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment…"
                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-fg outline-none placeholder:text-subtle"
              />
              <button
                type="button"
                aria-label="Send comment"
                disabled={(!text.trim() && !files.length) || busy === "comment"}
                onClick={send}
                className={cn("flex size-9 shrink-0 items-center justify-center rounded-full transition-colors", text.trim() || files.length ? "bg-brand text-white" : "bg-line/70 text-subtle")}
              >
                <SendHorizontal className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      {viewer && <PhotoViewer photos={viewer.list} start={viewer.start} onClose={() => setViewer(null)} />}
    </Sheet>
  );
}
