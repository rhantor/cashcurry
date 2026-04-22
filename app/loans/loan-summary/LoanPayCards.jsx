// /* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAddRepaymentEntryMutation } from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import useCurrency from "@/app/hooks/useCurrency";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";

export default function LoanPayCards({ summary = {} }) {
  const currency = useCurrency();
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();

  const { data: branches = [] } = useGetBranchesBasicQuery(companyId, {
    skip: !companyId,
  });
  const nameOf = (id) => branches.find((b) => b.id === id)?.name || id;

  const [addRepayment, { isLoading: saving }] = useAddRepaymentEntryMutation();

  const myOwedList = useMemo(() => {
    if (!branchId || !summary?.[branchId]) return [];
    const rels = summary[branchId].relations || {};
    return Object.entries(rels)
      .filter(([, rel]) => Number(rel.net) > 0.000001)
      .map(([otherId, rel]) => ({ otherId, ...rel }));
  }, [summary, branchId]);

  const [amounts, setAmounts] = useState({});
  const [notes, setNotes] = useState({});
  const [method, setMethod] = useState({});
  const [voucherNo, setVoucherNo] = useState({});
  const [bankName, setBankName] = useState({});
  const [referenceNo, setReferenceNo] = useState({});
  const [uploads, setUploads] = useState({}); // { [otherId]: { uploading, progress, url, name, mime, error } }

  const quickSet = (otherId, net, pct) => {
    setAmounts((a) => ({ ...a, [otherId]: (Number(net) * pct).toFixed(2) }));
  };

  const onFileChange = (otherId, file) => {
    if (!file || !companyId || !branchId) return;

    const okTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
    ];
    if (!okTypes.includes(file.type)) {
      setUploads((u) => ({
        ...u,
        [otherId]: {
          ...u[otherId],
          error: "Please upload JPG/PNG/WebP or PDF.",
        },
      }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploads((u) => ({
        ...u,
        [otherId]: { ...u[otherId], error: "Max file size is 10MB." },
      }));
      return;
    }

    const path = `loanRepayments/${companyId}/${branchId}_to_${otherId}/${Date.now()}_${
      file.name
    }`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    setUploads((u) => ({
      ...u,
      [otherId]: {
        uploading: true,
        progress: 0,
        url: "",
        name: file.name,
        mime: file.type,
        error: "",
      },
    }));

    task.on(
      "state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploads((u) => ({
          ...u,
          [otherId]: { ...u[otherId], progress: pct },
        }));
      },
      (err) => {
        setUploads((u) => ({
          ...u,
          [otherId]: { ...u[otherId], uploading: false, error: err.message },
        }));
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setUploads((u) => ({
          ...u,
          [otherId]: { ...u[otherId], uploading: false, url },
        }));
      }
    );
  };

  const pay = async (otherId, outstanding) => {
    if (!companyId || !branchId || !user) return;

    const amt = Number(amounts[otherId] || 0);
    if (!amt || amt <= 0) return alert("Enter a valid amount");
    if (amt > Number(outstanding) + 0.0001)
      return alert("Amount cannot exceed outstanding");

    const m = method[otherId] || "cash";
    const up = uploads[otherId] || {};
    const hasProof = !!up.url;
    if (!hasProof)
      return alert("Please upload proof (voucher/receipt) before paying.");

    if (m === "cash") {
      if (!voucherNo[otherId]) return alert("Please enter voucher no.");
    } else {
      if (!bankName[otherId]) return alert("Please enter bank name");
      if (!referenceNo[otherId])
        return alert("Please enter transaction/reference no.");
    }

    try {
      await addRepayment({
        companyId,
        fromBranchId: branchId, // borrower (payer)
        toBranchId: otherId, // lender (receiver)
        amount: amt,
        note: notes[otherId] || "",
        requestedBy: {
          uid: user?.uid || "",
          username: user?.username || "",
          role: user?.role || "",
          email: user?.email || "",
        },
        paymentMethod: m,
        proofUrl: up.url,
        proofMime: up.mime || null,
        voucherNo: voucherNo[otherId] || null,
        bankName: bankName[otherId] || null,
        referenceNo: referenceNo[otherId] || null,
        autoApprove: false, // receiver will approve
      }).unwrap();

      setAmounts((a) => ({ ...a, [otherId]: "" }));
      setNotes((n) => ({ ...n, [otherId]: "" }));
      setVoucherNo((s) => ({ ...s, [otherId]: "" }));
      setBankName((s) => ({ ...s, [otherId]: "" }));
      setReferenceNo((s) => ({ ...s, [otherId]: "" }));
      setUploads((u) => ({
        ...u,
        [otherId]: {
          uploading: false,
          progress: 0,
          url: "",
          name: "",
          mime: "",
          error: "",
        },
      }));
      alert("✅ Repayment submitted for approval");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to submit repayment");
    }
  };

  if (!ready) return <p className="p-4 text-sm text-gray-500">Syncing session...</p>;
  if (!branchId) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3">
        Settle Outstanding to Other Branches
      </h3>

      {myOwedList.length === 0 ? (
        <div className="text-sm text-gray-500">No outstanding to settle 🎉</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {myOwedList.map(({ otherId, net, durationDays, lastActivity }) => {
            const outstanding = Number(net || 0);
            const val = amounts[otherId] ?? "";
            const note = notes[otherId] ?? "";
            const m = method[otherId] || "cash";
            const up = uploads[otherId] || {};
            const isUploading = !!up.uploading;

            let lastText = "";
            if (lastActivity) {
              try {
                const dt = lastActivity?.seconds
                  ? new Date(lastActivity.seconds * 1000)
                  : new Date(lastActivity);
                if (!isNaN(dt.getTime())) lastText = dt.toLocaleDateString();
              } catch (e) {
                console.error("Error parsing date:", e);
              }
            }

            return (
              <div
                key={otherId}
                className="border rounded-2xl p-4 bg-white shadow-sm"
              >
                <div className="text-sm text-gray-500 mb-1">Pay to</div>
                <div className="text-base font-semibold mb-2">
                  {nameOf(otherId)}
                </div>

                <div className="text-sm mb-2">
                  Outstanding: <b>{currency} {outstanding.toFixed(2)}</b>
                  {typeof durationDays === "number" && (
                    <span className="ml-2 text-gray-500">
                      • {durationDays} days
                    </span>
                  )}
                </div>

                {lastText && (
                  <div className="text-xs text-gray-400 mb-2">
                    Last activity: {lastText}
                  </div>
                )}

                {/* Amount + quick buttons */}
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={val}
                    onChange={(e) =>
                      setAmounts((a) => ({ ...a, [otherId]: e.target.value }))
                    }
                    placeholder={`Amount (${currency})`}
                    inputMode="decimal"
                    className="w-36 border rounded px-2 py-2 text-sm"
                  />
                  <button
                    className="px-2 py-1 text-xs rounded bg-gray-100"
                    type="button"
                    onClick={() => quickSet(otherId, outstanding, 1)}
                  >
                    Full
                  </button>
                  <button
                    className="px-2 py-1 text-xs rounded bg-gray-100"
                    type="button"
                    onClick={() => quickSet(otherId, outstanding, 0.5)}
                  >
                    50%
                  </button>
                </div>

                {/* Method */}
                <div className="mb-2 flex items-center gap-4">
                  <label className="text-sm flex items-center gap-1">
                    <input
                      type="radio"
                      checked={m === "cash"}
                      onChange={() =>
                        setMethod((s) => ({ ...s, [otherId]: "cash" }))
                      }
                    />
                    Cash (voucher)
                  </label>
                  <label className="text-sm flex items-center gap-1">
                    <input
                      type="radio"
                      checked={m === "online"}
                      onChange={() =>
                        setMethod((s) => ({ ...s, [otherId]: "online" }))
                      }
                    />
                    Online transfer
                  </label>
                </div>

                {/* Method-specific fields */}
                {m === "cash" ? (
                  <input
                    value={voucherNo[otherId] ?? ""}
                    onChange={(e) =>
                      setVoucherNo((s) => ({ ...s, [otherId]: e.target.value }))
                    }
                    placeholder="Voucher No."
                    className="w-full border rounded px-2 py-2 text-sm mb-2"
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-2 mb-2">
                    <input
                      value={bankName[otherId] ?? ""}
                      onChange={(e) =>
                        setBankName((s) => ({
                          ...s,
                          [otherId]: e.target.value,
                        }))
                      }
                      placeholder="Bank name (e.g., Maybank)"
                      className="w-full border rounded px-2 py-2 text-sm"
                    />
                    <input
                      value={referenceNo[otherId] ?? ""}
                      onChange={(e) =>
                        setReferenceNo((s) => ({
                          ...s,
                          [otherId]: e.target.value,
                        }))
                      }
                      placeholder="Reference / Transaction No."
                      className="w-full border rounded px-2 py-2 text-sm"
                    />
                  </div>
                )}

                {/* Proof upload */}
                <div className="mb-2">
                  <label className="text-sm font-medium block mb-1">
                    Upload{" "}
                    {m === "cash" ? "voucher photo" : "receipt (image/PDF)"} *
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(e) => onFileChange(otherId, e.target.files?.[0])}
                    className="text-sm"
                    disabled={isUploading}
                  />
                  {up?.error && (
                    <div className="text-xs text-red-600 mt-1">{up.error}</div>
                  )}
                  {isUploading && (
                    <div className="text-xs text-gray-600 mt-1">
                      Uploading… {up.progress || 0}%
                    </div>
                  )}
                  {!isUploading && up?.url && (
                    <div className="text-xs text-emerald-700 mt-1">
                      Proof attached ✓ {up?.name ? `(${up.name})` : ""}
                    </div>
                  )}
                </div>

                {/* Note */}
                <input
                  value={note}
                  onChange={(e) =>
                    setNotes((n) => ({ ...n, [otherId]: e.target.value }))
                  }
                  placeholder="Reference / note (optional)"
                  className="w-full border rounded px-2 py-2 text-sm mb-3"
                />

                {/* Submit */}
                <button
                  disabled={saving || isUploading}
                  onClick={() => pay(otherId, outstanding)}
                  className={`w-full px-3 py-2 rounded text-sm text-white ${
                    saving || isUploading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-black"
                  }`}
                >
                  {saving || isUploading ? "Saving..." : "Pay Now"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
