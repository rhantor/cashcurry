"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

export default function KioskRedirect() {
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.replace("/login");
      return;
    }

    const user = JSON.parse(raw);
    const companyId = user.companyId;
    const cookieKey = companyId ? `activeBranch_${companyId}` : "activeBranch";
    const branchId = user.role === "owner" || user.role === "gm" || user.role === "superAdmin"
      ? Cookies.get(cookieKey)
      : user.branchId;

    if (branchId) {
      router.replace(`/kiosk/${branchId}`);
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="h-screen bg-gray-950 flex items-center justify-center text-white/40">
      Redirecting to Kiosk...
    </div>
  );
}
