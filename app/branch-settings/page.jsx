"use client";
import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Bell, Building2, Clock, CreditCard, ReceiptText, Save, ShieldCheck, ShoppingCart, TriangleAlert, Undo2 } from "lucide-react";
import BranchSection from "@/app/components/settings/BranchSection";
import MoneySection from "@/app/components/settings/MoneySection";
import PaymentMethodsSection from "@/app/components/settings/PaymentMethodsSection";
import ApprovalsSection from "@/app/components/settings/ApprovalsSection";
import AttendanceSettingsSection from "@/app/components/settings/AttendanceSettingsSection";
import PayrollSettingsSection from "@/app/components/settings/PayrollSettingsSection";
import NotificationsSection from "@/app/components/settings/NotificationsSection";
import { OrderReminderList } from "@/app/components/purchases/OrderReminders";
import useSession from "@/app/hooks/useSession";
import { canManageNotifications } from "@/lib/notify/model";
import StatusScreen from "@/app/components/common/StatusScreen";
import { Button, Card, Skeleton, cn, toast } from "@/app/components/ui";
import useBranchSettingsForm from "./useBranchSettingsForm";

const TABS = [
  { id: "branch", label: "Branch", note: "Name, contact, address", icon: Building2 },
  { id: "money", label: "Money", note: "Balances, currency, day end", icon: Banknote },
  { id: "payment", label: "Payment methods", note: "Cash, card, QR, delivery", icon: CreditCard },
  { id: "approvals", label: "Approvals & limits", note: "What needs a check first", icon: ShieldCheck },
  { id: "attendance", label: "Attendance", note: "Kiosk, shifts, pay cycle", icon: Clock },
  { id: "payroll", label: "Payroll", note: "Pay mode, OT, deductions", icon: ReceiptText },
  { id: "purchases", label: "Purchases", note: "Order reminders", icon: ShoppingCart },
  { id: "notifications", label: "Notifications", note: "Who is told what", icon: Bell, only: canManageNotifications },
];

// A section that doesn't bring its own card.
const Panel = ({ title, note, children }) => (
  <Card className="p-5">
    {title && (
      <div className="mb-4">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      </div>
    )}
    {children}
  </Card>
);

const Heading = ({ title, note }) => (
  <div className="mb-4">
    <h2 className="text-lg font-bold tracking-tight text-fg">{title}</h2>
    {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
  </div>
);

/**
 * Branch settings: one group at a time from the list on the left (a row of
 * tabs on phones). Changes collect until saved — a bar at the bottom says
 * there are unsaved changes, with Discard and Save.
 */
export default function BranchSettingsPage() {
  const { role, form, setForm, save, discard, saving, saveError, loadError, isDirty } = useBranchSettingsForm();
  const { companyId, branchId } = useSession();
  const [activeTab, setActiveTab] = useState("branch");
  const tabs = TABS.filter((t) => !t.only || t.only(role));
  const set = (group) => (v) => setForm((prev) => ({ ...prev, [group]: v }));

  const onSave = async () => {
    if (await save()) toast.success("Settings saved");
  };

  if (loadError)
    return (
      <StatusScreen
        full={false}
        icon={TriangleAlert}
        title="Branch settings couldn't load"
        message={loadError?.message || loadError?.error?.message || "Your account may not have access to this branch's settings."}
      />
    );

  if (!form)
    return (
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[15rem_1fr]">
        <Skeleton className="h-72" rounded="rounded-2xl" />
        <Skeleton className="h-[28rem]" rounded="rounded-2xl" />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 pb-32 sm:px-6 sm:py-6">
      <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
        {/* the groups */}
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:sticky md:top-20 md:mx-0 md:flex-col md:self-start md:overflow-visible md:px-0">
          {tabs.map((t) => {
            const on = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                  on ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                )}
              >
                {on && <motion.span layoutId="settings-tab" transition={{ type: "spring", stiffness: 400, damping: 34 }} className="absolute inset-0 rounded-2xl border border-line bg-surface shadow-card" />}
                <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-xl", on ? "bg-brand-soft text-brand" : "bg-surface-2")}>
                  <t.icon className="size-4" />
                </span>
                <span className="relative min-w-0">
                  <span className="block whitespace-nowrap text-sm font-semibold">{t.label}</span>
                  <span className="hidden truncate text-[11px] text-subtle md:block">{t.note}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* the chosen group */}
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-w-0 space-y-6">
          {activeTab === "notifications" && (
            <>
              <Heading title="Notifications" note="Who at this branch is told about each kind of thing. Requests are told at once; sales and costs once a day. Anyone can still turn off what they get, from the bell." />
              <NotificationsSection companyId={companyId} branchId={branchId} />
            </>
          )}

          {activeTab === "purchases" && (
            <>
              <Heading title="Order reminders" note="For what you order on set days, like vegetables every Monday. Who gets them: Notifications → Order reminders." />
              <Panel>
                <OrderReminderList companyId={companyId} branchId={branchId} />
              </Panel>
            </>
          )}

          {activeTab === "branch" && (
            <>
              <Heading title="Branch" note="The branch's name and how to reach it. These also show on invoices and purchase orders." />
              <BranchSection role={role} value={form.basic} onChange={set("basic")} />
            </>
          )}

          {activeTab === "money" && (
            <>
              <Heading title="Money" note="Where this branch's cash and bank figures start, and how its days are counted." />
              <MoneySection role={role} form={form} setForm={setForm} />
            </>
          )}

          {activeTab === "payment" && (
            <>
              <Heading title="Payment methods" note="How customers pay, and what each one does on Sales Entry and in the books." />
              <PaymentMethodsSection role={role} value={form.financeSales} onChange={set("financeSales")} />
            </>
          )}

          {activeTab === "approvals" && (
            <>
              <Heading title="Approvals & limits" note="What can be spent or sent without someone checking it first." />
              <ApprovalsSection role={role} form={form} setForm={setForm} />
            </>
          )}

          {activeTab === "attendance" && (
            <>
              <Heading title="Attendance" note="The pay cycle, how the kiosk behaves, and shifts." />
              <AttendanceSettingsSection
                role={role}
                companyId={form.companyId || form.basic?.companyId}
                branchId={form.branchId || form.basic?.branchId}
                value={form.attendance}
                onChange={set("attendance")}
              />
            </>
          )}

          {activeTab === "payroll" && (
            <>
              <Heading title="Payroll" note="Pay mode, overtime rates and statutory deductions. They apply to every staff member unless set on the person." />
              <Panel>
                <PayrollSettingsSection form={form} setForm={setForm} />
              </Panel>
            </>
          )}
        </motion.div>
      </div>

      {/* unsaved changes */}
      <AnimatePresence>
        {(isDirty || saveError) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl lg:bottom-5 lg:left-[calc(16rem+1.5rem)]"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 pl-4 shadow-float backdrop-blur">
              <p className={cn("min-w-0 flex-1 text-sm font-medium", saveError ? "text-danger" : "text-fg")}>{saveError || "You have changes that aren't saved"}</p>
              {isDirty && (
                <Button variant="ghost" icon={Undo2} onClick={discard} disabled={saving}>
                  <span className="hidden sm:inline">Discard</span>
                </Button>
              )}
              <Button icon={Save} onClick={onSave} loading={saving} disabled={!isDirty}>
                Save
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
