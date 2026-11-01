"use client";
// A voucher laid out like the paper one (owner, 1 Nov) — the same parts the
// picture has (lib/costs/voucherImage.js), from a sheet
// (lib/costs/voucherPaper.js). Boxes not yet signed are left empty. Paper
// stays white in dark mode, as paper does.
import { format, parseISO } from "date-fns";
import { cn } from "@/app/components/ui";
import { nameSignature } from "@/lib/signatures/client";

const when = (d) => (d ? format(d, "d MMM, h:mm a") : "");

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-gray-900">{children}</dd>
    </div>
  );
}

function SignBox({ box, sig }) {
  return (
    <div className="min-w-0 space-y-1 p-3 sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{box.label}</p>
      <div className="flex h-14 items-end">
        {box.stamp ? (
          <span className="-rotate-3 rounded border-2 border-green-700 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight text-green-700">{box.stamp}</span>
        ) : (
          sig && <img src={sig} alt={`${box.name}'s signature`} className="max-h-full max-w-full object-contain" />
        )}
      </div>
      <div className="border-t border-gray-900" />
      {box.waiting ? (
        <p className="pt-1 text-xs text-gray-400">{box.waiting}</p>
      ) : (
        <>
          <p className="truncate pt-1 text-sm font-semibold text-gray-900">{box.name || " "}</p>
          <p className="text-xs text-gray-500">{when(box.at)}</p>
        </>
      )}
    </div>
  );
}

/** `sheet` from lib/costs/voucherPaper.js; `sigs` { uid: signature data URL } for those who saved one. */
export default function VoucherPaper({ sheet, sigs = {} }) {
  const sigOf = (b) => (b.waiting || b.stamp ? null : b.sig || (b.uid && sigs[b.uid]) || nameSignature(b.name));
  return (
    <div className="overflow-hidden rounded-xl border-2 border-gray-900 bg-white text-gray-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 pt-4">
        <p className="min-w-0 text-base font-bold">{sheet.branchName}</p>
        <div className="text-right">
          <p className="text-sm font-extrabold tracking-wide">{sheet.title}</p>
          {sheet.subtitle && <p className="text-[11px] text-gray-500">{sheet.subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 px-4 pb-3 pt-2 text-sm font-semibold">
        <span>No. {sheet.no}</span>
        <span>Date {sheet.date ? format(parseISO(sheet.date), "d MMM yyyy") : ""}</span>
      </div>
      <dl className="border-y border-gray-200 px-4 py-2">
        {sheet.rows.map((r) => (
          <Row key={r.label} label={r.label}>
            {r.words ? (
              <>
                <span className="text-lg font-extrabold tabular-nums">{r.value}</span>
                <span className="block text-xs italic text-gray-600">{r.words}</span>
              </>
            ) : (
              <span className="whitespace-pre-line">{r.value}</span>
            )}
          </Row>
        ))}
      </dl>
      <div className={cn("grid divide-x divide-gray-200", sheet.boxes.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {sheet.boxes.map((b) => (
          <SignBox key={b.label} box={b} sig={sigOf(b)} />
        ))}
      </div>
    </div>
  );
}
