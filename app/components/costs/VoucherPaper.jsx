"use client";
// A voucher laid out like the paper one (owner, 1 Nov) — the same parts the
// picture made on approval has (lib/costs/voucherImage.js). While it waits the
// "Approved by" box is empty. Paper stays white in dark mode, as paper does.
import { format, parseISO } from "date-fns";

const when = (d) => (d ? format(d, "d MMM, h:mm a") : "");

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-gray-900">{children}</dd>
    </div>
  );
}

function SignBox({ label, sig, name, at, empty }) {
  return (
    <div className="min-w-0 space-y-1 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <div className="flex h-16 items-end">
        {sig && <img src={sig} alt={`${name}'s signature`} className="max-h-full max-w-full object-contain" />}
      </div>
      <div className="border-t border-gray-900" />
      {empty ? <p className="pt-1 text-xs text-gray-400">Waiting for approval</p> : (
        <>
          <p className="truncate pt-1 text-sm font-semibold text-gray-900">{name || " "}</p>
          <p className="text-xs text-gray-500">{when(at)}</p>
        </>
      )}
    </div>
  );
}

/** `sheet` from lib/costs/voucherPaper.js voucherSheet; `preparedSig` a data URL or null. */
export default function VoucherPaper({ sheet, preparedSig }) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-gray-900 bg-white text-gray-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 pt-4">
        <p className="min-w-0 text-base font-bold">{sheet.branchName}</p>
        <div className="text-right">
          <p className="text-sm font-extrabold tracking-wide">PAYMENT VOUCHER</p>
          <p className="text-[11px] text-gray-500">Cost with no invoice</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 px-4 pb-3 pt-2 text-sm font-semibold">
        <span>No. {sheet.no}</span>
        <span>Date {sheet.date ? format(parseISO(sheet.date), "d MMM yyyy") : ""}</span>
      </div>
      <dl className="border-y border-gray-200 px-4 py-2">
        <Row label="Paid to">{sheet.paidTo}</Row>
        <Row label="For">{sheet.category}</Row>
        <Row label="Paid from">{sheet.paidFrom}</Row>
        <Row label="Amount">
          <span className="text-lg font-extrabold tabular-nums">{sheet.amount}</span>
          <span className="block text-xs italic text-gray-600">{sheet.words}</span>
        </Row>
        <Row label="Why no invoice">{sheet.reason}</Row>
        {sheet.note && <Row label="Note"><span className="whitespace-pre-line">{sheet.note}</span></Row>}
      </dl>
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        <SignBox label="Prepared by" sig={preparedSig} name={sheet.prepared?.name} at={sheet.prepared?.at} />
        <SignBox label="Approved by" empty />
      </div>
    </div>
  );
}
