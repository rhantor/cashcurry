"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "./cn";
import { Skeleton } from "./Skeleton";
import EmptyState from "./EmptyState";

/**
 * A data table that fits any screen. On a computer: a table with sortable
 * columns. On a phone: each row becomes a card (no sideways scrolling).
 *
 * columns: [{
 *   key, label,
 *   render?: (row) => node,       // default: row[key]
 *   sortValue?: (row) => value,   // makes the column sortable (or sortable: true to sort by row[key])
 *   align?: "right",              // numbers
 *   primary?: true,               // the card title on phones
 *   aside?: true,                 // shown on the right of the card title on phones (e.g. the amount)
 *   hideOnMobile?: true,
 * }]
 * rows, rowKey (default "id"), loading, empty = { title, description, action },
 * onRowClick, pageSize (0 = no paging), footer (a totals row: { [key]: node }).
 */
export default function DataTable({
  columns, rows = [], rowKey = "id", loading = false, empty, onRowClick, pageSize = 10, footer, className,
  defaultSort,
}) {
  const [sort, setSort] = useState(defaultSort || null); // { key, dir: "asc" | "desc" }
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const val = col?.sortValue || ((r) => r[sort.key]);
    const out = [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null) return 1;
      if (y == null) return -1;
      return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
    });
    return sort.dir === "desc" ? out.reverse() : out;
  }, [rows, sort, columns]);

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize ? sorted.slice(current * pageSize, current * pageSize + pageSize) : sorted;

  const toggleSort = (key) => {
    setPage(0);
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  };
  const cell = (c, r) => (c.render ? c.render(r) : r[c.key]);
  const primary = columns.find((c) => c.primary) || columns[0];
  const aside = columns.find((c) => c.aside && c !== primary);
  const clickable = !!onRowClick;

  if (!loading && rows.length === 0 && empty) {
    return (
      <div className={cn("rounded-2xl border border-line bg-surface", className)}>
        <EmptyState {...empty} />
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      {/* ── computer: table ── */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2/90 backdrop-blur">
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable || c.sortValue;
                const active = sort?.key === c.key;
                const Arrow = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn("whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted", c.align === "right" ? "text-right" : "text-left")}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn("inline-flex items-center gap-1 transition-colors hover:text-fg", active && "text-fg")}
                      >
                        {c.label}
                        <motion.span key={active ? sort.dir : "none"} initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}>
                          <Arrow className={cn("size-3.5", !active && "opacity-40")} />
                        </motion.span>
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading
              ? Array.from({ length: Math.min(pageSize || 6, 6) }, (_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3.5">
                        <Skeleton className={cn("h-3.5", c.align === "right" ? "ml-auto w-16" : "w-3/4")} />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((r, i) => (
                  <motion.tr
                    key={r[rowKey] ?? i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.02 } }}
                    onClick={clickable ? () => onRowClick(r) : undefined}
                    className={cn("transition-colors hover:bg-surface-2/60", clickable && "cursor-pointer")}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn("px-4 py-3 text-fg", c.align === "right" && "text-right tabular-nums")}
                      >
                        {cell(c, r)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
          </tbody>
          {footer && !loading && (
            <tfoot className="border-t border-line bg-surface-2/60 font-semibold">
              <tr>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 text-fg", c.align === "right" && "text-right tabular-nums")}>
                    {footer[c.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── phone: cards ── */}
      <ul className="divide-y divide-line sm:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </li>
            ))
          : visible.map((r, i) => (
              <motion.li
                key={r[rowKey] ?? i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
                whileTap={clickable ? { scale: 0.985 } : undefined}
                onClick={clickable ? () => onRowClick(r) : undefined}
                className={cn("p-4", clickable && "cursor-pointer active:bg-surface-2")}
              >
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm font-semibold text-fg">{cell(primary, r)}</div>
                  {aside && <div className="shrink-0 text-sm font-bold tabular-nums text-fg">{cell(aside, r)}</div>}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {columns
                    .filter((c) => c !== primary && c !== aside && !c.hideOnMobile)
                    .map((c) => (
                      <div key={c.key} className="contents">
                        <dt className="text-muted">{c.label}</dt>
                        <dd className={cn("text-fg", c.align === "right" && "text-right tabular-nums")}>{cell(c, r)}</dd>
                      </div>
                    ))}
                </dl>
              </motion.li>
            ))}
        {footer && !loading && (() => {
          // the first filled cell names the row ("Total"); the rest are its figures
          const [head, ...rest] = columns.filter((c) => footer[c.key] != null && footer[c.key] !== "");
          return (
            <li className="flex items-start justify-between gap-3 bg-surface-2/60 p-4 text-sm font-semibold">
              <span className="text-muted">{head && footer[head.key]}</span>
              <span className="space-y-0.5 text-right">
                {rest.map((c) => (
                  <span key={c.key} className="block tabular-nums text-fg">
                    {rest.length > 1 && <span className="mr-2 text-xs font-medium text-muted">{c.label}</span>}
                    {footer[c.key]}
                  </span>
                ))}
              </span>
            </li>
          );
        })()}
      </ul>

      {/* ── paging ── */}
      {pageSize > 0 && !loading && sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
          <span className="tabular-nums">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <PageButton disabled={current === 0} onClick={() => setPage(current - 1)} label="Previous page">
              <ChevronLeft className="size-4" />
            </PageButton>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={current}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="min-w-14 text-center font-semibold text-fg tabular-nums"
              >
                {current + 1} / {pages}
              </motion.span>
            </AnimatePresence>
            <PageButton disabled={current >= pages - 1} onClick={() => setPage(current + 1)} label="Next page">
              <ChevronRight className="size-4" />
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
}

const PageButton = ({ disabled, onClick, label, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-label={label}
    className="rounded-lg p-1.5 transition hover:bg-surface-2 hover:text-fg disabled:opacity-30"
  >
    {children}
  </button>
);
