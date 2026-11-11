"use client";
// Setting up the branch kiosk (11 Nov 2026). The old kiosk ran here under the
// manager's own sign-in, checked PINs on the tablet and kept photos in the
// punches. Now this page only sets a tablet up: a manager taps "Use this
// tablet as the kiosk" once, and the tablet then runs /clock with no sign-in.
// It also lists the branch's kiosk tablets, to stop one that is lost.
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { skipToken } from "@reduxjs/toolkit/query";
import { ArrowLeft, Clock, MonitorSmartphone, Play, Trash2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import useSession from "@/app/hooks/useSession";
import useRetryOnError from "@/app/hooks/useRetryOnError";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { clearKiosk, kioskBranch, kioskToken, setKiosk, tabletZone } from "@/lib/attendance/kioskClient";
import { Button, Card, CardBody, Field, Input, confirmDialog, toast } from "@/app/components/ui";
import { can } from "@/lib/authz/permissions";
import KioskPeople from "./People";

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never");

async function call(method, body, query = "") {
  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch(`/api/kiosk/devices${query}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ""}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export default function KioskSetup() {
  const { branchId } = useParams();
  const router = useRouter();
  const { user, status } = useSession();
  const companyId = user?.companyId;
  // asked only once Firebase has the sign-in, or the rules refuse it
  const ready = status === "signedIn" && !!companyId;
  const branchQ = useGetSingleBranchQuery(ready && branchId ? { companyId, branchId } : skipToken);
  useRetryOnError(branchQ);
  const branch = branchQ.data || {};
  const [devices, setDevices] = useState(null);
  const [name, setName] = useState("Front tablet");
  const [busy, setBusy] = useState(false);
  const [here, setHere] = useState(null); // this tablet is this branch's kiosk

  useEffect(() => {
    const b = kioskBranch();
    setHere(!!kioskToken() && b?.branchId === branchId && b?.companyId === companyId);
  }, [branchId, companyId]);

  const list = useCallback(async () => {
    if (!companyId) return;
    try {
      const r = await call("GET", null, `?companyId=${encodeURIComponent(companyId)}&branchId=${encodeURIComponent(branchId)}`);
      setDevices(r.devices);
    } catch (e) {
      setDevices([]);
      toast.error(e.message);
    }
  }, [companyId, branchId]);
  useEffect(() => {
    if (status === "signedIn") list();
  }, [status, list]);

  const setUp = async () => {
    setBusy(true);
    try {
      // a tablet that was another branch's kiosk stops being it
      const { token } = await call("POST", { companyId, branchId, name, timeZone: tabletZone() });
      clearKiosk();
      setKiosk(token, { companyId, branchId });
      router.push("/clock");
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  const stopHere = async () => {
    if (!(await confirmDialog({ title: "Stop using this tablet as the kiosk?", message: "Staff can't punch on it until it is set up again. Punches already saved stay.", confirmLabel: "Stop", danger: true }))) return;
    try {
      await call("DELETE", { companyId, branchId, token: kioskToken() });
    } catch {
      /* gone already: still forget it here */
    }
    clearKiosk();
    setHere(false);
    list();
  };

  const remove = async (d) => {
    if (!(await confirmDialog({ title: `Remove “${d.name}”?`, message: "That tablet stops working as the kiosk at once (e.g. it was lost). Punches already saved stay.", confirmLabel: "Remove", danger: true }))) return;
    try {
      await call("DELETE", { companyId, branchId, id: d.id });
      toast.success("Removed");
      list();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-xl space-y-5">
        <button type="button" onClick={() => router.push(can(user?.role, "dashboard.branch") ? "/" : "/attendance-log")} className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Back to the app
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Attendance kiosk</p>
          <h1 className="text-2xl font-bold text-fg">{branch?.name || "This branch"}</h1>
          <p className="mt-1 text-sm text-muted">Staff clock in and out on one tablet at the branch: they look at the camera (or tap their name and enter their PIN), and a small photo is kept. No one signs in on the tablet; if the internet drops, punches are kept and sent later.</p>
        </div>

        <Card>
          <CardBody className="space-y-4">
            {here ? (
              <>
                <div className="flex items-center gap-3">
                  <MonitorSmartphone className="size-6 text-brand" />
                  <p className="font-semibold text-fg">This tablet is this branch&apos;s kiosk.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button icon={Play} onClick={() => router.push("/clock")}>Open the kiosk</Button>
                  <Button variant="ghost" className="text-danger" onClick={stopHere}>Stop using this tablet</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">Do this once, on the tablet that stays at the branch. You can then sign out — the kiosk keeps working.</p>
                <Field label="Name for this tablet">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Front tablet" />
                </Field>
                <Button icon={Clock} loading={busy} disabled={!companyId} onClick={setUp}>Use this tablet as the kiosk</Button>
              </>
            )}
          </CardBody>
        </Card>

        {can(user?.role, "attendance.faces") && ready && <KioskPeople companyId={companyId} branchId={branchId} />}

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Kiosk tablets at this branch</p>
          {devices === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted">None yet.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-fg">{d.name}</p>
                    <p className="text-xs text-muted">Set up by {d.by || "—"} · last seen {when(d.lastSeenAt)}</p>
                  </div>
                  <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${d.name}`} onClick={() => remove(d)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
