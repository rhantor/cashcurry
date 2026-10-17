// Recounts each vendor's totals (billed, paid, owed, last payment) from every
// branch's bills and payments. The totals are normally kept up as bills are
// saved and paid; this mends them if they ever drift (or for old data).
import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch } from "firebase/firestore";

export async function recountVendorTotals(companyId, log = () => {}) {
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
  log(`Found ${vendorsSnap.docs.length} vendors.`);

  // 2. Get all branches
  const branchesSnap = await getDocs(collection(db, "companies", companyId, "branches"));
  log(`Found ${branchesSnap.docs.length} branches. Processing...`);

  // 3. Process bills and payments for each branch
  const skipped = [];
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
      skipped.push(branch.data()?.name || branchId);
    }
  }

  // Totals are company-wide: counting only some branches would overwrite them
  // with too-small numbers, so stop before writing anything.
  if (skipped.length) throw new Error(`Couldn't read ${skipped.join(", ")} — only someone who can see every branch can recount.`);

  // 4. Batch update all vendors
  log("Writing results to database...");
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
  return { vendors: vendorsSnap.docs.length, branches: branchesSnap.docs.length };
}
