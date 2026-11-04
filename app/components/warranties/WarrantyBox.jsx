"use client";
// "Has warranty" and its details, where a purchase is entered: Cost Entry and a
// pay-out's bill. `warranty`: { on, setOn, value, onChange, paper, onPaper }.
import { ShieldCheck } from "lucide-react";
import { Switch } from "@/app/components/ui";
import WarrantyFields from "./WarrantyFields";

export default function WarrantyBox({ warranty, vendors, errors, startDate }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">Has warranty</p>
          <p className="text-xs text-muted">You&apos;ll be told 15 and 7 days before it ends.</p>
        </div>
        <Switch checked={warranty.on} onChange={warranty.setOn} />
      </div>
      {warranty.on && (
        <div className="mt-4">
          <WarrantyFields value={{ ...warranty.value, startDate: warranty.value.startDate || startDate }} onChange={warranty.onChange} vendors={vendors} errors={errors || {}} paper={warranty.paper} onPaper={warranty.onPaper} />
        </div>
      )}
    </div>
  );
}
