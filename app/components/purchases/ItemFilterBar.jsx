/* eslint-disable react/prop-types */
"use client";
import React, { useMemo } from "react";
import { Search, X } from "lucide-react";

/**
 * Search box plus a row of category chips.
 *
 * A catalog of a couple of hundred lines is not something anyone can hold in
 * their head, and typing a name means already knowing it. Categories are the
 * grouping the restaurant itself uses, so one tap on "Sisha" is the fastest way
 * to the eleven things that matter right now. Chips rather than a dropdown
 * because a chip is a single tap and shows the counts up front.
 */
export default function ItemFilterBar({
  items = [],
  search,
  onSearchChange,
  category,
  onCategoryChange,
  placeholder = "Find an item…",
}) {
  // Counts come from the incoming list, so they always reflect whatever
  // filtering the caller has already applied — the vendor on a guide, say.
  const categories = useMemo(() => {
    const counts = new Map();
    items.forEach((i) => {
      const c = i.category?.trim() || "Uncategorized";
      counts.set(c, (counts.get(c) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const chip = (active) =>
    `shrink-0 min-h-[40px] px-3.5 rounded-2xl text-sm font-semibold transition-colors ${
      active ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 active:bg-slate-100"
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
                       rounded-full text-slate-400 active:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {categories.length > 1 && (
        // Horizontal scroll keeps forty categories to one line instead of a
        // wall of chips pushing the list off the screen.
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={() => onCategoryChange("")} className={chip(!category)}>
            All {items.length}
          </button>
          {categories.map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => onCategoryChange(category === name ? "" : name)}
              className={chip(category === name)}
            >
              {name} <span className={category === name ? "opacity-70" : "text-slate-400"}>{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Apply what ItemFilterBar collected. Kept here so every caller filters alike. */
export function filterItems(items, { search = "", category = "" } = {}) {
  const q = search.trim().toLowerCase();
  return items.filter((i) => {
    if (category && (i.category?.trim() || "Uncategorized") !== category) return false;
    if (!q) return true;
    return (
      i.name?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.unit?.toLowerCase().includes(q)
    );
  });
}
