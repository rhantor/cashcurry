"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth,
  startOfWeek, subDays, subMonths,
} from "date-fns";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { cn } from "./cn";
import Popover from "./Popover";
import { Sheet } from "./Dialog";
import { useIsPhone } from "./useMedia";

// Dates are "yyyy-MM-dd" strings everywhere, like the rest of the app.
const key = (d) => format(d, "yyyy-MM-dd");
const nice = (k) => (k ? format(parseISO(k), "d MMM yyyy") : "");

/** The picker's button looks like a field. */
function TriggerButton({ refEl, open, toggle, text, placeholder, invalid, className }) {
  return (
    <button
      ref={refEl}
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-xl border bg-surface px-3.5 text-left text-sm outline-none transition",
        "focus:border-brand focus:ring-4 focus:ring-[var(--cc-ring)]",
        open ? "border-brand ring-4 ring-[var(--cc-ring)]" : invalid ? "border-danger" : "border-line",
        className
      )}
    >
      <CalendarDays className="size-4 shrink-0 text-muted" />
      <span className={cn("truncate", text ? "text-fg" : "text-subtle")}>{text || placeholder}</span>
    </button>
  );
}

/**
 * Where a picker opens: a popover under its field on computers, a bottom
 * sheet on phones (a floating calendar doesn't fit beside a thumb).
 * children({ close, phone }) draws the inside.
 */
function PickerShell({ title, trigger, onOpen, align, children }) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const change = (o) => {
    setOpen(o);
    if (o) onOpen?.();
  };
  const close = () => change(false);
  if (phone) {
    return (
      <>
        {trigger({ open, toggle: () => change(!open) })}
        <Sheet open={open} onClose={close} title={title} layer="z-[300]">
          {children({ close, phone: true })}
        </Sheet>
      </>
    );
  }
  return (
    <Popover align={align} open={open} onOpenChange={change} trigger={trigger}>
      {() => children({ close, phone: false })}
    </Popover>
  );
}

/**
 * One month grid. Moving between months slides the days in from that side.
 * `pick(day)` gets a "yyyy-MM-dd"; `range` = {from, to} highlights a span.
 */
function Calendar({ month, setMonth, today, selected, range, hover, setHover, pick, max, wide = false }) {
  const [dir, setDir] = useState(0);
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);
  const go = (n) => {
    setDir(n);
    setMonth(addMonths(month, n));
  };

  // the span to paint: a chosen range, or start → the day under the pointer
  const lo = range?.from;
  const hi = range?.to || (range?.from && hover && hover > range.from ? hover : null);

  return (
    <div className={cn("select-none", wide ? "w-full" : "w-[17.5rem] p-2")}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg" aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </button>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span
            key={key(month)}
            custom={dir}
            initial={{ opacity: 0, y: dir > 0 ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm font-semibold text-fg"
          >
            {format(month, "MMMM yyyy")}
          </motion.span>
        </AnimatePresence>
        <button type="button" onClick={() => go(1)} className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg" aria-label="Next month">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-subtle">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={key(month)}
            custom={dir}
            initial={{ x: dir > 0 ? 40 : -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 36 } }}
            exit={{ x: dir > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.12 } }}
            className="grid grid-cols-7 gap-y-0.5"
            onMouseLeave={() => setHover?.(null)}
          >
            {days.map((d) => {
              const k = key(d);
              const out = !isSameMonth(d, month);
              const disabled = max && k > max;
              const isSel = k === selected || k === lo || k === hi;
              const inSpan = lo && hi && k > lo && k < hi;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(k)}
                  onMouseEnter={() => setHover?.(k)}
                  className={cn(
                    "relative text-sm transition-colors",
                    wide ? "h-11" : "h-9",
                    "disabled:cursor-not-allowed disabled:opacity-30",
                    inSpan && "bg-brand-soft",
                    k === lo && hi && "rounded-l-xl bg-brand-soft",
                    k === hi && lo && "rounded-r-xl bg-brand-soft"
                  )}
                >
                  <span
                    className={cn(
                      "mx-auto flex items-center justify-center rounded-xl font-medium transition",
                      wide ? "size-10" : "size-9",
                      isSel ? "bg-brand font-semibold text-brand-fg shadow-sm" : out ? "text-subtle" : "text-fg hover:bg-surface-2",
                      !isSel && k === today && "ring-1 ring-brand text-brand"
                    )}
                  >
                    {format(d, "d")}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** One date. `value`/`onChange` use "yyyy-MM-dd". Future dates can be blocked with `max`. */
export function DatePicker({ value, onChange, placeholder = "Pick a date", max, invalid, className }) {
  const today = useBusinessToday();
  const [month, setMonth] = useState(() => parseISO(value || today));
  return (
    <PickerShell
      title={placeholder}
      onOpen={() => setMonth(parseISO(value || today))}
      trigger={({ open, toggle, ref }) => (
        <TriggerButton refEl={ref} open={open} toggle={toggle} text={nice(value)} placeholder={placeholder} invalid={invalid} className={className} />
      )}
    >
      {({ close, phone }) => (
        <div>
          <Calendar
            wide={phone}
            month={month}
            setMonth={setMonth}
            today={today}
            selected={value}
            max={max}
            pick={(k) => {
              onChange?.(k);
              close();
            }}
          />
          <div className={cn("flex gap-1 border-t border-line", phone ? "mt-2 pt-3" : "p-2")}>
            {[
              ["Today", today],
              ["Yesterday", key(subDays(parseISO(today), 1))],
            ].map(([label, k]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onChange?.(k);
                  close();
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand transition hover:bg-brand-soft"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </PickerShell>
  );
}

/**
 * A span of dates: tap the first day, then the last (the span fills in as you
 * move). Presets on the side for the usual periods. value = { from, to }.
 */
export function DateRangePicker({ value, onChange, placeholder = "Pick dates", max, className }) {
  const today = useBusinessToday();
  const t = parseISO(today);
  const [month, setMonth] = useState(() => parseISO(value?.from || today));
  const [draft, setDraft] = useState(null); // first click of a new range
  const [hover, setHover] = useState(null);

  const presets = [
    ["Today", today, today],
    ["Yesterday", key(subDays(t, 1)), key(subDays(t, 1))],
    ["Last 7 days", key(subDays(t, 6)), today],
    ["This month", key(startOfMonth(t)), today],
    ["Last month", key(startOfMonth(subMonths(t, 1))), key(endOfMonth(subMonths(t, 1)))],
  ];
  const text =
    value?.from && value?.to
      ? value.from === value.to
        ? nice(value.from)
        : `${format(parseISO(value.from), "d MMM")} – ${nice(value.to)}`
      : "";

  return (
    <PickerShell
      title={placeholder}
      align="start"
      onOpen={() => {
        setDraft(null);
        setMonth(parseISO(value?.from || today));
      }}
      trigger={({ open, toggle, ref }) => (
        <TriggerButton refEl={ref} open={open} toggle={toggle} text={text} placeholder={placeholder} className={className} />
      )}
    >
      {({ close, phone }) => (
        <div className={phone ? "space-y-4" : "flex flex-row"}>
          <div className={phone ? "flex flex-wrap gap-2" : "flex w-36 flex-col gap-1 border-r border-line p-2"}>
            {presets.map(([label, from, to]) => {
              const active = !draft && value?.from === from && value?.to === to;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onChange?.({ from, to });
                    close();
                  }}
                  className={cn(
                    "whitespace-nowrap text-left text-xs font-semibold transition",
                    phone ? "rounded-full border px-3 py-1.5" : "rounded-lg px-2.5 py-1.5",
                    active
                      ? "border-brand bg-brand-soft text-brand"
                      : cn("text-muted hover:bg-surface-2 hover:text-fg", phone ? "border-line" : "border-transparent")
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div>
            <Calendar
              wide={phone}
              month={month}
              setMonth={setMonth}
              today={today}
              max={max}
              range={draft ? { from: draft, to: null } : value}
              hover={hover}
              setHover={setHover}
              pick={(k) => {
                if (!draft) return setDraft(k);
                const [from, to] = k < draft ? [k, draft] : [draft, k];
                setDraft(null);
                onChange?.({ from, to });
                close();
              }}
            />
            <p className={cn("text-xs text-muted", phone ? "mt-3 text-center" : "px-3 pb-2")}>{draft ? `From ${nice(draft)} — now pick the last day` : "Pick the first day"}</p>
          </div>
        </div>
      )}
    </PickerShell>
  );
}
