"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Monitor, Moon, Palette, ReceiptText, Sun, Users } from "lucide-react";
import BranchManagement from "../components/settings/BranchManagement";
import UserManagement from "../components/settings/users/UserMangement";
import CostCategories from "../components/settings/CostCategories";
import { Card, cn, useTheme } from "@/app/components/ui";
import { ChoiceCards } from "@/app/components/entry/Choices";

const SECTIONS = [
  { id: "users", label: "People", note: "Who can sign in, and their role", icon: Users },
  { id: "branches", label: "Branches", note: "Add and look after branches", icon: Building2 },
  { id: "costs", label: "Cost categories", note: "What costs can be entered under", icon: ReceiptText },
  { id: "appearance", label: "Appearance", note: "Light or dark", icon: Palette },
];

/** Light, dark, or as the device is set — kept on this device. */
function Appearance() {
  const [theme, setTheme] = useTheme();
  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-fg">Theme</h3>
      <p className="mb-4 mt-0.5 text-sm text-muted">Applies on this device only, so each person can pick their own.</p>
      <ChoiceCards
        className="sm:grid-cols-3"
        value={theme}
        onChange={setTheme}
        options={[
          { value: "light", title: "Light", note: "Always light", icon: Sun, tone: "warning" },
          { value: "dark", title: "Dark", note: "Easier at night", icon: Moon, tone: "info" },
          { value: "system", title: "Like the device", note: "Follows the phone or computer", icon: Monitor, tone: "brand" },
        ]}
      />
    </Card>
  );
}

/**
 * Company settings: the people who can sign in (company and branch users),
 * the branches, and how the app looks. Each branch's own settings live in
 * Branch Settings.
 */
export default function SettingsPage() {
  const [active, setActive] = useState("users");
  const sec = SECTIONS.find((s) => s.id === active);

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:sticky md:top-20 md:mx-0 md:flex-col md:self-start md:overflow-visible md:px-0">
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                aria-current={on ? "page" : undefined}
                className={cn("relative flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors", on ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
              >
                {on && <motion.span layoutId="company-settings-tab" transition={{ type: "spring", stiffness: 400, damping: 34 }} className="absolute inset-0 rounded-2xl border border-line bg-surface shadow-card" />}
                <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-xl", on ? "bg-brand-soft text-brand" : "bg-surface-2")}>
                  <s.icon className="size-4" />
                </span>
                <span className="relative min-w-0">
                  <span className="block whitespace-nowrap text-sm font-semibold">{s.label}</span>
                  <span className="hidden truncate text-[11px] text-subtle md:block">{s.note}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <motion.div key={active} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-w-0 space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-fg">{sec.label}</h2>
            <p className="mt-0.5 text-sm text-muted">{sec.note}</p>
          </div>
          {active === "users" && <UserManagement />}
          {active === "branches" && <BranchManagement />}
          {active === "costs" && <CostCategories />}
          {active === "appearance" && <Appearance />}
        </motion.div>
      </div>
    </div>
  );
}
