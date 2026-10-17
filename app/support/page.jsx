"use client";
import { useState } from "react";
import { Check, Copy, LifeBuoy, Mail, RefreshCw, ShieldQuestion, Wifi } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import { Button, Card, cn, toast } from "@/app/components/ui";

// Set NEXT_PUBLIC_SUPPORT_EMAIL to show a way to write to the Cash Curry team.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
const ROLE = { owner: "Owner", gm: "General manager", superAdmin: "Super admin", branchAdmin: "Branch admin", manager: "Manager", accountant: "Accountant", supervisor: "Supervisor", cashier: "Cashier", staff: "Staff" };

const TIPS = [
  { icon: RefreshCw, title: "Something looks stuck or out of date", text: "Pull down to refresh on a phone, or reload the page. Saved entries are kept." },
  { icon: Wifi, title: "It won't save", text: "Check the internet. If it still fails, note the time and what you were saving." },
  { icon: ShieldQuestion, title: "A page says it isn't open to you", text: "Each role sees its own pages. Ask your branch admin or the owner if you need one." },
];

/**
 * Help: quick fixes for the usual problems, who to ask, and the details to
 * send with a problem (copied in one tap).
 */
export default function SupportPage() {
  const { user } = useSession();
  const [copied, setCopied] = useState(false);

  const details = [
    `User: ${user?.username || user?.userName || "—"}`,
    `Role: ${ROLE[user?.role] || user?.role || "—"}`,
    `Branch: ${user?.branchName || user?.branchId || "—"}`,
    `Company: ${user?.companyId || "—"}`,
    `When: ${new Date().toLocaleString()}`,
    `Device: ${typeof navigator !== "undefined" ? navigator.userAgent : "—"}`,
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      toast.success("Copied — paste it in your message");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy — select the text and copy it");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <LifeBuoy className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg">How can we help?</h1>
          <p className="text-sm text-muted">Most problems have a quick fix.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TIPS.map((t) => (
          <Card key={t.title} className="p-4">
            <t.icon className="size-5 text-brand" />
            <p className="mt-2 text-sm font-semibold text-fg">{t.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t.text}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-fg">Still stuck?</h2>
        <p className="mt-1 text-sm text-muted">
          Tell your branch admin or the owner first — most things (access, settings, a wrong entry) they can fix. Send these details with your message so the problem can be found quickly:
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-muted">{details}</pre>
        <div className={cn("mt-4 flex flex-wrap gap-2")}>
          <Button variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
            {copied ? "Copied" : "Copy details"}
          </Button>
          {SUPPORT_EMAIL && (
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Cash Curry help")}&body=${encodeURIComponent(`What happened:\n\n\n---\n${details}`)}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg transition hover:brightness-105"
            >
              <Mail className="size-4" /> Write to the Cash Curry team
            </a>
          )}
        </div>
      </Card>
    </div>
  );
}
