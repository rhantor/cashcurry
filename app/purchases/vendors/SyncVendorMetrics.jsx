"use client";
import React, { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, writeBatch } from "firebase/firestore";
import Button from "@/app/components/common/Button";

export default function SyncVendorMetrics({ companyId }) {
  const [syncing, setSyncing] = useState(false);
  const [lines, setLines] = useState([]);

  const handleSync = async () => {
    if (!companyId) return alert("Missing company ID");
    if (!confirm("Run vendor metrics sync builder? This will parse all bills/payments.")) return;

    setSyncing(true);
    setLines(["Starting synchronization..."]);
    const appendLog = (msg) => setLines((prev) => [...prev, msg]);

    try {
      // 1. Get all vendors
      const vendorsSnap = await getDocs(collection(db, "companies", companyId, "vendors"));
      const vendorsMap = {}; // vendorId -> { totalBilled, totalPaid, lastPaymentDate }
      const vendorDocs = {}; // vendorId -> doc reference
      
      vendorsSnap.docs.forEach(d => {
         vendorsMap[d.id] = { 
           totalBilled: 0, 
           totalPaid: 0, 
           lastPaymentDate: 0,
           currentBalance: 0
         };
         vendorDocs[d.id] = d.ref;
      });
      appendLog(`Found ${vendorsSnap.docs.length} vendors.`);

      // 2. Get all branches
      const branchesSnap = await getDocs(collection(db, "companies", companyId, "branches"));
      appendLog(`Found ${branchesSnap.docs.length} branches. Processing...`);

      // 3. Process bills and payments for each branch
      for (const branch of branchesSnap.docs) {
        const branchId = branch.id;
        
        try {
          // Bills
          const billsSnap = await getDocs(collection(db, "companies", companyId, "branches", branchId, "vendorBills"));
          billsSnap.docs.forEach(bDoc => {
            const b = bDoc.data();
            const vId = b.vendorId;
            if (vId && vendorsMap[vId]) {
              vendorsMap[vId].totalBilled += Number(b.total || 0);
              vendorsMap[vId].currentBalance += Number(b.balance || 0);
            }
          });
          
          // Payments
          const paymentsSnap = await getDocs(collection(db, "companies", companyId, "branches", branchId, "vendorPayments"));
          paymentsSnap.docs.forEach(pDoc => {
            const p = pDoc.data();
            const vId = p.vendorId;
            if (vId && vendorsMap[vId]) {
              vendorsMap[vId].totalPaid += Number(p.total || 0);
              
              let pTime = 0;
              if (p.createdAtClient) {
                pTime = new Date(p.createdAtClient).getTime();
              } else if (p.createdAt?.seconds) {
                pTime = p.createdAt.seconds * 1000;
              }
              
              if (pTime > vendorsMap[vId].lastPaymentDate) {
                vendorsMap[vId].lastPaymentDate = pTime;
              }
            }
          });
        } catch (branchErr) {
          console.warn(`Skipping branch ${branchId}:`, branchErr.message);
          appendLog(`Skipped reading branch ${branchId}: Permission Denied`);
        }
      }

      // 4. Batch update all vendors
      appendLog("Writing results to database...");
      const batch = writeBatch(db);
      for (const vId in vendorsMap) {
        const data = vendorsMap[vId];
        batch.update(vendorDocs[vId], {
          totalBilled: data.totalBilled,
          totalPaid: data.totalPaid,
          lastPaymentDate: data.lastPaymentDate > 0 ? new Date(data.lastPaymentDate).toISOString() : null,
          currentBalance: data.currentBalance // fixing any desync in AP Balance while we are at it
        });
      }

      await batch.commit();
      appendLog("Sync Completed Successfully! Please refresh the page.");
      
    } catch (err) {
      console.error(err);
      appendLog("Error: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl shadow-sm mb-6">
      <h3 className="font-bold mb-2">Historical Data Sync</h3>
      <p className="text-sm mb-4">Run this once to backfill all Vendor payment metrics (Total Billed, Total Paid, Last Payment Date) from existing payments and bills.</p>
      
      <Button onClick={handleSync} disabled={syncing} className="bg-yellow-600 hover:bg-yellow-700 text-white">
        {syncing ? "Synchronizing..." : "Sync Vendor Metrics Now"}
      </Button>
      
      {lines.length > 0 && (
        <div className="mt-4 p-3 bg-white border rounded text-xs text-gray-700 h-32 overflow-y-auto">
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
