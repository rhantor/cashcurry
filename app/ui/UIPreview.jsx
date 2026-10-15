"use client";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Banknote, Check, Landmark, Monitor, Moon, Plus, Receipt, RotateCcw,
  Search, Send, Sun, TrendingUp, Wallet,
} from "lucide-react";
import {
  Badge, Button, Card, CardBody, CardHeader, CountUp, Dialog, EmptyState, Field, Input, Loader, Select, Sheet,
  Skeleton, SkeletonRows, SkeletonStat, Stagger, Switch, Tabs, Textarea, TopProgressBar, UIProvider, useTheme, useToast,
} from "@/app/components/ui";
import { formatMoney } from "@/lib/region";

const rm = (v) => formatMoney(v, "MYR");

const KPIS = [
  { label: "Total sales", value: 8800, icon: TrendingUp, delta: "+12%", tone: "success" },
  { label: "Cash in hand", value: 2050, icon: Wallet, delta: "−3%", tone: "danger" },
  { label: "Bank", value: 3900, icon: Landmark, delta: "+8%", tone: "success" },
  { label: "Costs", value: 1280.5, icon: Receipt, delta: "+2%", tone: "warning" },
];

const ACTIVITY = [
  { who: "Kumar Raj", what: "Advance requested", amount: 150, tone: "warning", status: "Pending", icon: ArrowUpRight },
  { who: "Siti Aminah", what: "Staff loan approved", amount: 600, tone: "info", status: "To pay", icon: Banknote },
  { who: "KL Cashier", what: "Sales entered", amount: 1600, tone: "success", status: "Saved", icon: ArrowDownLeft },
  { who: "PJ Admin", what: "Loan to KL repaid", amount: 200, tone: "brand", status: "Done", icon: Check },
];

export default function UIPreview() {
  return (
    <UIProvider>
      <Gallery />
    </UIProvider>
  );
}

function Gallery() {
  const [theme, setTheme] = useTheme();
  const [run, setRun] = useState(0); // bump to replay entrance animations
  const [loading, setLoading] = useState(false);

  // Dark mode is only for this page until the real screens are redesigned.
  useEffect(() => () => document.documentElement.classList.remove("dark"), []);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="mr-auto flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-brand font-black text-brand-fg">C</span>
            <div>
              <p className="text-sm font-bold leading-tight">Cash Curry UI</p>
              <p className="text-xs text-muted">Design system preview · Phase 3.1</p>
            </div>
          </div>
          <Tabs
            size="sm"
            value={theme}
            onChange={setTheme}
            tabs={[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "Auto", icon: Monitor },
            ]}
          />
          <Button variant="secondary" size="sm" icon={RotateCcw} onClick={() => setRun((n) => n + 1)}>
            Replay
          </Button>
        </div>
      </header>

      <main key={run} className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        <Section title="Dashboard cards" note="Numbers count up; cards rise in one after another. Flip the switch to see loading skeletons.">
          <div className="mb-4">
            <Switch checked={loading} onChange={setLoading} label="Show loading state" />
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {KPIS.map((k) => (
                <SkeletonStat key={k.label} />
              ))}
            </div>
          ) : (
            <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {KPIS.map((k) => (
                <Card key={k.label} interactive className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">{k.label}</span>
                    <span className="flex size-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <k.icon className="size-4" />
                    </span>
                  </div>
                  <CountUp value={k.value} format={rm} className="mt-3 block text-xl font-bold tracking-tight sm:text-2xl" />
                  <Badge tone={k.tone} className="mt-2">
                    {k.delta} vs last month
                  </Badge>
                </Card>
              ))}
            </Stagger>
          )}
        </Section>

        <Section title="Buttons" note="Press them: they push in. Save shows a spinner, then a check that draws itself.">
          <ButtonsDemo />
        </Section>

        <div className="grid gap-10 lg:grid-cols-2">
          <Section title="Form" note="Submit empty: the field shakes and the message slides in.">
            <FormDemo />
          </Section>
          <Section title="Toasts" note="They slide in, stack, close themselves (hover pauses), and swipe away.">
            <ToastDemo />
          </Section>
        </div>

        <Section title="Lists" note="Rows appear one by one; skeletons while loading; a friendly empty state.">
          <ListDemo />
        </Section>

        <div className="grid gap-10 lg:grid-cols-2">
          <Section title="Dialog and bottom sheet" note="The dialog pops in. The sheet slides up — drag its handle down to close (try it on a phone).">
            <OverlayDemo />
          </Section>
          <Section title="Status, toggles, loaders" note="Badges, switches, the page loader and the top progress bar.">
            <MiscDemo />
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <section>
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      {note && <p className="mb-4 mt-1 text-sm text-muted">{note}</p>}
      {children}
    </section>
  );
}

function ButtonsDemo() {
  const [state, setState] = useState("idle");
  const save = () => {
    setState("loading");
    setTimeout(() => setState("success"), 1200);
    setTimeout(() => setState("idle"), 2600);
  };
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={state === "loading"} success={state === "success"} icon={Check}>
          Save sale
        </Button>
        <Button variant="secondary" icon={Plus}>
          Add cost
        </Button>
        <Button variant="soft" icon={Send}>
          Request advance
        </Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Reject</Button>
        <Button variant="secondary" size="icon" aria-label="Search">
          <Search className="size-4" />
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </div>
    </Card>
  );
}

function FormDemo() {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount above zero");
      return;
    }
    setError(null);
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Advance requested", { description: `${rm(amount)} — waiting for approval` });
      setAmount("");
    }, 900);
  };
  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Amount (RM)" error={error} hint="Up to 30% of your basic salary">
          {({ id, invalid }) => (
            <Input id={id} invalid={invalid} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          )}
        </Field>
        <Field label="Type">
          {({ id }) => (
            <Select id={id} defaultValue="personal">
              <option value="personal">Salary advance</option>
              <option value="medical">Medical leave</option>
              <option value="annual">Annual leave</option>
            </Select>
          )}
        </Field>
        <Field label="Reason">{({ id }) => <Textarea id={id} placeholder="A short note for your manager" />}</Field>
        <Button type="submit" loading={saving} className="w-full">
          Send request
        </Button>
      </form>
    </Card>
  );
}

function ToastDemo() {
  const toast = useToast();
  const wait = (ok) => new Promise((res, rej) => setTimeout(() => (ok ? res() : rej(new Error("Network unavailable"))), 1400));
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => toast.success("Sale saved", { description: "Demo Branch KL · RM 1,600.00" })}>
          Success
        </Button>
        <Button variant="secondary" onClick={() => toast.error("Could not save", { description: "Check the amount and try again" })}>
          Error
        </Button>
        <Button variant="secondary" onClick={() => toast.warning("Day not closed", { description: "Yesterday has no sales entry" })}>
          Warning
        </Button>
        <Button variant="secondary" onClick={() => toast.info("New request", { description: "Kumar asked for an advance" })}>
          Info
        </Button>
        <Button
          variant="soft"
          onClick={() => toast.promise(wait(true), { loading: "Marking paid…", success: "Marked paid" }).catch(() => {})}
        >
          Promise ✓
        </Button>
        <Button
          variant="soft"
          onClick={() => toast.promise(wait(false), { loading: "Uploading Z report…", error: "Upload failed" }).catch(() => {})}
        >
          Promise ✗
        </Button>
      </div>
    </Card>
  );
}

function ListDemo() {
  const [view, setView] = useState("list");
  return (
    <Card>
      <CardHeader
        title="Recent activity"
        subtitle="Today · Demo Branch KL"
        action={
          <Tabs
            size="sm"
            value={view}
            onChange={setView}
            tabs={[
              { value: "list", label: "List" },
              { value: "loading", label: "Loading" },
              { value: "empty", label: "Empty" },
            ]}
          />
        }
      />
      <CardBody className="pt-2">
        {view === "loading" && <SkeletonRows rows={4} />}
        {view === "empty" && (
          <EmptyState
            title="No activity yet"
            description="Sales, costs and requests you enter today will show up here."
            action={<Button size="sm" icon={Plus}>Enter today&apos;s sales</Button>}
          />
        )}
        {view === "list" && (
          <Stagger as="ul" className="divide-y divide-line">
            {ACTIVITY.map((a) => (
              <Stagger.Item as="li" key={a.who + a.what} className="flex items-center gap-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                  <a.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.who}</p>
                  <p className="truncate text-xs text-muted">{a.what}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{rm(a.amount)}</p>
                  <Badge tone={a.tone} dot className="mt-1">
                    {a.status}
                  </Badge>
                </div>
              </Stagger.Item>
            ))}
          </Stagger>
        )}
      </CardBody>
    </Card>
  );
}

function OverlayDemo() {
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [range, setRange] = useState("month");
  const [paying, setPaying] = useState(false);
  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setDialog(false);
      toast.success("Marked paid", { description: "RM 600.00 from the till — cash updated" });
    }, 1000);
  };
  return (
    <Card className="p-5">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setDialog(true)}>Open dialog</Button>
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Open bottom sheet
        </Button>
      </div>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Mark this loan paid?"
        description="Siti Aminah · staff loan · RM 600.00"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button onClick={pay} loading={paying}>
              Mark paid
            </Button>
          </>
        }
      >
        <Field label="Paid from">
          {({ id }) => (
            <Select id={id} defaultValue="front">
              <option value="front">Till (cash)</option>
              <option value="back">Bank</option>
            </Select>
          )}
        </Field>
      </Dialog>
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter"
        description="Choose what the dashboard shows"
        footer={
          <Button className="w-full" onClick={() => setSheet(false)}>
            Apply
          </Button>
        }
      >
        <div className="space-y-4">
          <Tabs
            value={range}
            onChange={setRange}
            tabs={[{ value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "custom", label: "Custom" }]}
          />
          <Skeleton className="h-24" />
          <Skeleton className="h-10" />
        </div>
      </Sheet>
    </Card>
  );
}

function MiscDemo() {
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [bar, setBar] = useState(false);
  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap gap-2">
        <Badge>Draft</Badge>
        <Badge tone="brand">Approved</Badge>
        <Badge tone="success" dot>
          Paid
        </Badge>
        <Badge tone="warning" dot pulse>
          Waiting
        </Badge>
        <Badge tone="danger">Rejected</Badge>
        <Badge tone="info">New</Badge>
      </div>
      <div className="flex flex-wrap gap-6">
        <Switch checked={on} onChange={setOn} label="Notifications" />
        <Switch checked={off} onChange={setOff} label="Night shift" />
      </div>
      <div className="rounded-xl border border-dashed border-line">
        <Loader label="Loading report" />
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          setBar(true);
          setTimeout(() => setBar(false), 2200);
        }}
      >
        Show page progress bar
      </Button>
      <TopProgressBar active={bar} />
    </Card>
  );
}
