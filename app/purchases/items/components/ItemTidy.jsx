"use client";
// Tidying this branch's catalog (lib/purchases/items.js): names that look the
// same (one is likely a double), items missing a supplier, category or price,
// and items not bought here in 90 days — with Edit, Retire or Stop stocking here.
import React from "react";
import { Archive, Copy, MinusCircle, Moon, Pencil, PenLine, Sparkles } from "lucide-react";
import { Button, EmptyState } from "@/app/components/ui";
import { useItemsContext } from "../ItemsContext";

const MISSING = { supplier: "no supplier", category: "no category", price: "no price" };

function Section({ icon: Icon, title, hint, count, children }) {
  if (!count) return null;
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex items-start gap-3 border-b border-line bg-surface-2/60 px-4 py-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-info" />
        <div>
          <p className="font-bold text-fg">
            {title} <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{count}</span>
          </p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
      </div>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

export default function ItemTidy() {
  const { tidy, canManage, handleOpenEdit, setItemToRetire, setItemToDrop, setDetailItem, branchId } = useItemsContext();
  const total = tidy.alike.length + tidy.missing.length + tidy.idle.length;

  const Row = ({ item, sub, stockedElsewhere }) => (
    <li className="flex items-center gap-2 p-3">
      <button type="button" onClick={() => setDetailItem(item)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-fg">{item.name}</p>
        <p className="truncate text-[11px] text-muted">{sub}</p>
      </button>
      {canManage && (
        <span className="flex shrink-0 gap-1">
          <Button size="icon" variant="ghost" aria-label={`Edit ${item.name}`} title="Edit" onClick={() => handleOpenEdit(item)} className="size-9">
            <Pencil className="size-4" />
          </Button>
          {stockedElsewhere && branchId ? (
            <Button size="icon" variant="ghost" aria-label={`Stop stocking ${item.name} here`} title="Stop stocking here" onClick={() => setItemToDrop(item)} className="size-9">
              <MinusCircle className="size-4" />
            </Button>
          ) : (
            <Button size="icon" variant="ghost" aria-label={`Retire ${item.name}`} title="Retire" onClick={() => setItemToRetire(item)} className="size-9">
              <Archive className="size-4" />
            </Button>
          )}
        </span>
      )}
    </li>
  );

  if (!total) return <EmptyState className="rounded-3xl border border-line bg-surface py-14" icon={Sparkles} title="All tidy" description="No look-alike names, nothing missing, everything bought lately." />;

  return (
    <div className="space-y-4">
      <Section icon={Copy} title="Names that look the same" hint="Probably one product entered twice — keep one (fix its details) and retire the other." count={tidy.alike.length}>
        {tidy.alike.map((group) =>
          group.map((item, i) => <Row key={item.id} item={item} sub={`${i === 0 ? "Looks like" : "…and"} ${group.filter((x) => x.id !== item.id).map((x) => `“${x.name}”`).join(", ")} · ${item.unit || "no unit"}`} />)
        )}
      </Section>

      <Section icon={PenLine} title="Missing details" hint="A supplier lets orders and guides offer it; a price makes the order's estimate right." count={tidy.missing.length}>
        {tidy.missing.map(({ item, missing }) => (
          <Row key={item.id} item={item} sub={missing.map((m) => MISSING[m]).join(" · ")} />
        ))}
      </Section>

      <Section icon={Moon} title="Not bought in 90 days" hint="Still used? Leave it. If not, retire it — or stop stocking it at this branch only." count={tidy.idle.length}>
        {tidy.idle.map(({ item, lastBought }) => (
          <Row key={item.id} item={item} sub={lastBought ? `Last bought ${lastBought}` : "Never bought here"} stockedElsewhere={(item.branchIds || []).length > 1} />
        ))}
      </Section>
    </div>
  );
}
