"use client";
// The staff portal's requests: ask for an advance or leave, and see where
// each request has got to (requests engine, roadmap 4.2).
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { CalendarPlus, HandCoins } from "lucide-react";
import { db } from "@/lib/firebase";
import useSession from "@/app/hooks/useSession";
import { Button, Skeleton } from "@/app/components/ui";
import MyRequests from "@/app/components/requests/MyRequests";
import AdvanceAskSheet from "@/app/components/requests/AdvanceAskSheet";
import LeaveSheet from "@/app/components/requests/LeaveSheet";

export default function RequestsPage() {
  // Live session: the profile refresh after login fills in staffId.
  const { user } = useSession();
  const [lookedUpStaffId, setLookedUpStaffId] = useState(null);
  const [sheet, setSheet] = useState(null); // "advance" | "leave"

  // Logins created before staffId was recorded on the user: find the staff
  // record by its uid instead (npm run staff:link fixes them for good).
  useEffect(() => {
    if (!user?.uid || !user?.companyId || !user?.branchId || user.staffId) return;
    const q = query(collection(db, "companies", user.companyId, "branches", user.branchId, "staff"), where("uid", "==", user.uid));
    getDocs(q).then((snap) => {
      if (!snap.empty) setLookedUpStaffId(snap.docs[0].id);
    });
  }, [user?.uid, user?.companyId, user?.branchId, user?.staffId]);

  const me = user ? { ...user, staffId: user.staffId || lookedUpStaffId } : null;
  const where_ = { companyId: user?.companyId, branchId: user?.branchId };

  if (!me) return <div className="space-y-3 p-4">{[0, 1].map((i) => <Skeleton key={i} className="h-28" rounded="rounded-2xl" />)}</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-24 sm:p-6">
      <div className="grid grid-cols-2 gap-3">
        <Button icon={HandCoins} onClick={() => setSheet("advance")}>Ask for advance</Button>
        <Button variant="secondary" icon={CalendarPlus} onClick={() => setSheet("leave")}>Ask for leave</Button>
      </div>
      <MyRequests {...where_} user={me} />
      <AdvanceAskSheet open={sheet === "advance"} onClose={() => setSheet(null)} {...where_} user={me} />
      <LeaveSheet open={sheet === "leave"} onClose={() => setSheet(null)} {...where_} user={me} />
    </div>
  );
}
