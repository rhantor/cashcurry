"use client";
// Settings → Roles (owner, 15 Nov 2026): what each role can do, and five extra
// rights the owner or a super admin may switch on. Switches only add — no
// role's own rights can be taken away here — and "Back to default" turns them
// all off. Saved in companies/{c}/settings/roles; people get a change the next
// time their app opens or comes back to the screen.
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Check, Plus, RotateCcw } from "lucide-react";
import { db } from "@/lib/firebase";
import useSession from "@/app/hooks/useSession";
import { OPTIONAL_GRANTS, ROLE_LABELS, can, cleanGrants, roleLabel } from "@/lib/authz/permissions";
import { GUIDE_ROLES, ROLE_GUIDE } from "@/lib/authz/roleGuide";
import { createAuditLog } from "@/lib/redux/api/auditUtils";
import { Button, Card, Skeleton, Switch, cn } from "@/app/components/ui";
import { confirmDialog, toast } from "@/app/components/ui/notify";

const SHORT = { owner: "Owner", superAdmin: "Super admin", gm: "GM", branchAdmin: "Branch admin", manager: "Manager", inCharge: "In-charge", accountant: "Accountant", supervisor: "Supervisor", cashier: "Cashier", kitchenLead: "Kitchen", kiosk: "Kiosk" };

export default function RolesSettings() {
  const { user } = useSession();
  const companyId = user?.companyId;
  const editable = can(user?.role, "company.manage");
  const [grants, setGrants] = useState(null);
  const [busy, setBusy] = useState("");
  const ref = useMemo(() => (companyId ? doc(db, "companies", companyId, "settings", "roles") : null), [companyId]);

  useEffect(() => {
    if (!ref) return;
    getDoc(ref)
      .then((s) => setGrants(cleanGrants(s.exists() ? s.data().grants : null)))
      .catch(() => setGrants({}));
  }, [ref]);

  const isOn = (g) => !!grants?.[g.capability]?.includes(g.role);

  const save = async (next, words) => {
    try {
      await setDoc(ref, { grants: next, updatedAt: serverTimestamp(), updatedBy: { uid: user?.uid || "", name: user?.name || user?.fullName || user?.username || "" } });
      setGrants(next);
      createAuditLog({ companyId, user, action: "UPDATE_ROLE_SETTINGS", details: words, targetId: "roles" }).catch(() => {});
      toast.success("Saved", { description: "People get it the next time their app opens or comes back to the screen." });
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    }
  };

  const flip = async (g, on) => {
    setBusy(g.capability);
    const next = { ...grants };
    const list = new Set(next[g.capability] || []);
    if (on) list.add(g.role);
    else list.delete(g.role);
    if (list.size) next[g.capability] = [...list];
    else delete next[g.capability];
    await save(next, `${on ? "Switched on" : "Switched off"}: ${g.label}`);
    setBusy("");
  };

  const reset = async () => {
    if (!(await confirmDialog({ title: "Back to default?", message: "Every extra right below is switched off. Each role keeps what it always has.", confirmLabel: "Back to default" }))) return;
    setBusy("reset");
    await save({}, "Role settings back to default");
    setBusy("");
  };

  if (!grants) return <Skeleton className="h-64" rounded="rounded-2xl" />;
  const anyOn = OPTIONAL_GRANTS.some(isOn);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-fg">Extra rights</h3>
            <p className="mt-0.5 text-sm text-muted">
              Off by default. Switching one on adds it for that role in every branch; nothing here takes a right away.
              {!editable && " Only the owner or a super admin can change these."}
            </p>
          </div>
          {editable && anyOn && (
            <Button size="sm" variant="secondary" icon={RotateCcw} loading={busy === "reset"} onClick={reset}>
              Back to default
            </Button>
          )}
        </div>
        <ul className="mt-4 divide-y divide-line">
          {OPTIONAL_GRANTS.map((g) => (
            <li key={`${g.capability}:${g.role}`} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{g.label}</p>
                <p className="text-xs text-muted">{g.note}</p>
              </div>
              <Switch checked={isOn(g)} disabled={!editable || !!busy} onChange={(on) => flip(g, on)} aria-label={g.label} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-0">
        <div className="px-5 pb-2 pt-5">
          <h3 className="text-base font-semibold text-fg">Who can do what</h3>
          <p className="mt-0.5 text-sm text-muted">
            <Check className="inline size-3.5 text-success" /> what the role always has ·{" "}
            <Plus className="inline size-3.5 text-brand" /> switched on above · staff use the staff app for their own things
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-2/60 text-[11px] uppercase tracking-wide text-subtle">
                <th className="sticky left-0 z-10 min-w-[13rem] bg-surface-2 px-4 py-2 text-left font-semibold">Can</th>
                {GUIDE_ROLES.map((r) => (
                  <th key={r} className="px-2 py-2 text-center font-semibold" title={ROLE_LABELS[r] || roleLabel(r)}>
                    {SHORT[r]}
                  </th>
                ))}
              </tr>
            </thead>
            {ROLE_GUIDE.map((group) => (
              <tbody key={group.title}>
                <tr>
                  <td colSpan={GUIDE_ROLES.length + 1} className="sticky left-0 bg-surface px-4 pb-1 pt-4 text-xs font-bold text-fg">
                    {group.title}
                  </td>
                </tr>
                {group.rows.map(([cap, label]) => (
                  <tr key={cap} className="border-t border-line">
                    <td className="sticky left-0 z-10 bg-surface px-4 py-2 text-fg">{label}</td>
                    {GUIDE_ROLES.map((r) => {
                      const base = can(r, cap, {});
                      const extra = !base && can(r, cap, grants);
                      return (
                        <td key={r} className={cn("px-2 py-2 text-center", extra && "bg-brand-soft")}>
                          {base ? <Check className="mx-auto size-4 text-success" aria-label="Yes" /> : extra ? <Plus className="mx-auto size-4 text-brand" aria-label="Switched on" /> : <span className="text-subtle">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Card>
    </div>
  );
}
