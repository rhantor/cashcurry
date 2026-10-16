"use client";
import { businessToday } from "@/lib/region";
import React, { useState, useEffect } from "react";
import { useAddAdvanceEntryMutation, useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import { useAddNotificationMutation } from "@/lib/redux/api/notificationApiSlice";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import { toast } from "@/app/components/ui/notify";

export default function RequestsPage() {
  // Live session: the profile refresh after login fills in staffId.
  const { user } = useSession();
  const [lookedUpStaffId, setLookedUpStaffId] = useState(null);

  // Logins created before staffId was recorded on the user: find the staff
  // record by its uid instead (npm run staff:link fixes them for good).
  useEffect(() => {
    if (!user?.uid || !user?.companyId || !user?.branchId || user.staffId) return;
    const q = query(
      collection(db, "companies", user.companyId, "branches", user.branchId, "staff"),
      where("uid", "==", user.uid)
    );
    getDocs(q).then(snap => {
      if (!snap.empty) setLookedUpStaffId(snap.docs[0].id);
    });
  }, [user?.uid, user?.companyId, user?.branchId, user?.staffId]);
  const staffDocId = user?.staffId || lookedUpStaffId;

  // Only this person's: the ones they asked for and the ones entered for
  // their staff record (staff may not read anyone else's).
  const skipQuery = !user?.uid || !user?.companyId || !user?.branchId;
  const { data: myRequests = [], isLoading } = useGetAdvanceEntriesQuery(
    { companyId: user?.companyId, branchId: user?.branchId, mine: { uid: user?.uid, staffId: user?.staffId } },
    { skip: skipQuery }
  );

  const [addAdvance, { isLoading: submitting }] = useAddAdvanceEntryMutation();
  const [addNotification] = useAddNotificationMutation();
  const [form, setForm] = useState({ amount: "", reason: "", advanceType: "personal" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !staffDocId) return toast.info("Still loading your profile...");
    if (!form.amount || !form.reason) return toast.warning("Fill all fields");

    const reqTypeStr = form.advanceType === "personal" ? "Salary Advance" : form.advanceType === "medical" ? "Medical Leave" : "Annual Leave";
    const title = `New ${reqTypeStr} Request`;
    const msgData = `${user.firstName || user.username} has requested ${form.advanceType === 'personal' ? '$' + form.amount : 'leave'} for: ${form.reason}`;

    try {
      await addAdvance({
        companyId: user.companyId,
        branchId: user.branchId,
        data: {
          staffId: staffDocId,
          staffName: user.firstName || user.username || "Staff",
          amount: Number(form.amount) || 0,
          reason: form.reason,
          advanceType: form.advanceType,
          status: "pending",
          date: businessToday(), // on the branch's clock
          repaymentInstallments: 1,
          createdBy: { uid: user.uid, name: user.firstName || "Staff" },
        }
      }).unwrap();

      // Trigger notification for Branch Admin / Managers
      await addNotification({
         companyId: user.companyId,
         notification: {
            title,
            message: msgData,
            branchId: user.branchId,
            actionUrl: `/branch/${user.branchId}/staff-management` // Example route point
         }
      }).unwrap();
      
      setForm({ amount: "", reason: "", advanceType: "personal" });
      toast.success("Request submitted successfully!");
    } catch(err) {
      toast.error("Error submitting request: " + err.message);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved": return <CheckCircle className="text-green-500" size={18} />;
      case "rejected": return <XCircle className="text-red-500" size={18} />;
      default: return <Clock className="text-orange-400" size={18} />;
    }
  };

  if (!user) return <div className="p-8 text-center animate-pulse text-gray-400">Loading...</div>;

  return (
    <div className="p-4 sm:p-6 pb-24 space-y-6">
       <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
         <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
           <FileText size={22} className="text-blue-600" /> New Request
         </h2>
         <form onSubmit={handleSubmit} className="space-y-4">
           <div>
             <label className="block text-sm font-semibold mb-1 text-gray-700">Request Type</label>
             <select 
               value={form.advanceType} 
               onChange={e => setForm({...form, advanceType: e.target.value})}
               className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
             >
               <option value="personal">Salary Advance</option>
               <option value="medical">Medical Leave</option>
               <option value="annual">Annual Leave</option>
             </select>
           </div>
           
           {form.advanceType === "personal" && (
             <div>
               <label className="block text-sm font-semibold mb-1 text-gray-700">Amount ($)</label>
               <input 
                 type="number" 
                 value={form.amount} 
                 onChange={e => setForm({...form, amount: e.target.value})}
                 placeholder="0.00"
                 className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
               />
             </div>
           )}

           <div>
             <label className="block text-sm font-semibold mb-1 text-gray-700">Reason / Notes</label>
             <textarea 
               value={form.reason}
               onChange={e => setForm({...form, reason: e.target.value})}
               placeholder="Why do you need this?"
               rows={3}
               className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
             />
           </div>

           <button 
             type="submit" 
             disabled={submitting}
             className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition disabled:opacity-50"
           >
             {submitting ? "Submitting..." : "Submit Request"}
           </button>
         </form>
       </div>

       <div>
         <h2 className="text-xl font-bold mb-4 text-gray-900">My History</h2>
         <div className="space-y-3">
           {isLoading ? (
             <div className="text-center p-4 text-gray-400">Loading history...</div>
           ) : myRequests.length === 0 ? (
             <div className="p-6 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
               No past requests found.
             </div>
           ) : (
             myRequests.map(req => (
               <div key={req.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                     <div>
                       <span className="font-bold text-gray-800 capitalize">{req.advanceType} Request</span>
                       <div className="text-xs text-gray-400 font-medium">{req.date}</div>
                     </div>
                     <div className="flex items-center gap-1 font-semibold text-sm capitalize px-2 py-1 bg-gray-50 rounded-lg">
                       {getStatusIcon(req.status)}
                       <span className={req.status === 'approved' ? 'text-green-600' : req.status === 'rejected' ? 'text-red-600' : 'text-gray-600'}>
                         {req.status}
                       </span>
                     </div>
                  </div>
                  {req.amount > 0 && <div className="text-xl font-extrabold text-blue-600">${req.amount}</div>}
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg mt-1">{req.reason}</p>
               </div>
             ))
           )}
         </div>
       </div>
    </div>
  );
}
