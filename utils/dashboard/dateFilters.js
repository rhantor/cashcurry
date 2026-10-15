// Dashboard period filters: { from: Date, to: Date, preset }.
//
// A period is always whole local days — `from` at 00:00, `to` at 23:59:59.999 —
// so the hooks and the date label agree on which days are inside it.
import { addDays, endOfDay, format, parseISO, startOfDay, startOfMonth } from "date-fns";

const DAYS = { week: 7, days30: 30 };

/**
 * "month" (this month so far), "week" (last 7 days) or "days30" (last 30 days).
 * Periods end on `today` — pass the branch's business date (useBusinessToday)
 * so that just after midnight, before the day cut-off, "today" is still the
 * trading day that is closing.
 */
export function presetFilter(preset, now = new Date(), today = format(now, "yyyy-MM-dd")) {
  const day = parseISO(today);
  const from = DAYS[preset]
    ? startOfDay(addDays(day, -(DAYS[preset] - 1)))
    : startOfMonth(day);
  return { from, to: endOfDay(day), preset: DAYS[preset] ? preset : "month" };
}

/** A "yyyy-MM-dd" from a date input, as the start of that local day. */
export function filterFromInput(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** A "yyyy-MM-dd" from a date input, as the end of that local day. */
export function filterToInput(value) {
  return endOfDay(filterFromInput(value));
}

/** The filter's first and last day as "yyyy-MM-dd", for labels and inputs. */
export function dayKeyOfFilter(filter) {
  return {
    from: filter?.from ? format(filter.from, "yyyy-MM-dd") : "",
    to: filter?.to ? format(filter.to, "yyyy-MM-dd") : "",
  };
}
