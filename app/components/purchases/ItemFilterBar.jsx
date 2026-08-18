/* eslint-disable react/prop-types */
"use client";
import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

/** How many chips to show before collapsing behind a "more" button. */
const COLLAPSED = 12;

const catOf = (i) => i.category?.trim() || "Uncategorized";

/**
 * Search box plus category chips.
 *
 * A catalog of a couple of hundred lines is not something anyone can hold in
 * their head, and typing a name means already knowing it. Categories are the
 * grouping the restaurant itself uses, so one tap on "Sisha" is the fastest way
 * to the eleven things that matter right now.
 *
 * The chips wrap rather than scroll sideways. A swipeable strip works on a
 * phone but strands everything past the fold on a desktop, where a mouse wheel
 * scrolls the page instead of the strip. Wrapping needs no gesture at all, and
 * the overflow collapses behind a count so forty categories do not push the
 * list off the screen.
 */
export default function ItemFilterBar({
  items = [],
  search,
  onSearchChange,
  category,
  onCategoryChange,
  placeholder = "Find an item…",
}) {
  const [showAll, setShowAll] = useState(false);

  const q = search.trim().toLowerCase();

  // Chips describe whatever the search has narrowed things to — and only the
  // search, so choosing a category never hides the others. Typing "sisha" leaves
  // one chip reading "Sisha 10"; typing "tomato" leaves "Vegetables 1". Counts
  // still respect any filtering the caller did first, such as a guide's vendor.
  const categories = useMemo(() => {
    const counts = new Map();
    filterItems(items, { search }).forEach((i) => {
      const c = catOf(i);
      counts.set(c, (counts.get(c) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items, search]);

  const matchCount = useMemo(() => filterItems(items, { search }).length, [items, search]);

  // A search has already cut this down, so there is no point collapsing it.
  const expanded = showAll || !!q;
  const shown = expanded ? categories : categories.slice(0, COLLAPSED);
  const hidden = categories.length - shown.length;

  // Never hide the chip that is currently doing the filtering.
  const visible = category && !shown.some(([n]) => n === category)
    ? [...shown, categories.find(([n]) => n === category) || [category, 0]]
    : shown;

  const chip = (active) =>
    `min-h-[40px] px-3.5 rounded-2xl text-sm font-semibold transition-colors ${
      active
        ? "bg-slate-900 text-white"
        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 active:bg-slate-100"
    }`;

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[48px] pl-10 pr-10 text-[15px] border border-slate-200 rounded-2xl bg-slate-50
                     focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none
                     transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center
                       rounded-full text-slate-400 hover:bg-slate-100 active:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Kept visible while searching even when it narrows to one category —
          that chip is the confirmation that the search landed somewhere. */}
      {(categories.length > 1 || q || category) && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onCategoryChange("")} className={chip(!category)}>
            All <span className={!category ? "opacity-70" : "text-slate-400"}>{matchCount}</span>
          </button>

          {visible.map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => onCategoryChange(category === name ? "" : name)}
              className={chip(category === name)}
            >
              {name} <span className={category === name ? "opacity-70" : "text-slate-400"}>{count}</span>
            </button>
          ))}

          {hidden > 0 && !expanded && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="min-h-[40px] px-3.5 rounded-2xl text-sm font-semibold text-mint-700 bg-mint-50
                         hover:bg-mint-100 active:bg-mint-200 transition-colors"
            >
              +{hidden} more
            </button>
          )}

          {showAll && categories.length > COLLAPSED && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="min-h-[40px] px-3.5 rounded-2xl text-sm font-semibold text-slate-500
                         hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Apply what ItemFilterBar collected. Kept here so every caller filters alike. */
export function filterItems(items, { search = "", category = "" } = {}) {
  const q = search.trim().toLowerCase();
  return items.filter((i) => {
    if (category && catOf(i) !== category) return false;
    if (!q) return true;
    return (
      i.name?.toLowerCase().includes(q) ||
      catOf(i).toLowerCase().includes(q) ||
      i.unit?.toLowerCase().includes(q)
    );
  });
}
