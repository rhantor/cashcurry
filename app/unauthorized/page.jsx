"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, House, ShieldAlert } from "lucide-react";
import StatusScreen from "@/app/components/common/StatusScreen";
import useSession from "@/app/hooks/useSession";

const ROLE = { owner: "an owner", gm: "a general manager", superAdmin: "a super admin", branchAdmin: "a branch admin", manager: "a manager", accountant: "an accountant", supervisor: "a supervisor", cashier: "a cashier", staff: "staff" };

// "/company/dashboard" → "Company dashboard"
const pageName = (path) => {
  const words = String(path || "").split("/").filter(Boolean).join(" ").replace(/-/g, " ");
  return words ? words[0].toUpperCase() + words.slice(1) : "";
};

// Where the middleware sends someone who opens a page their role can't use
// (?from=/the/page). Says so plainly and offers a way on.
function Unauthorized() {
  const router = useRouter();
  const from = useSearchParams().get("from");
  const { user } = useSession();
  const as = ROLE[user?.role];
  return (
    <StatusScreen
      full={false}
      icon={ShieldAlert}
      tone="warning"
      code="403"
      title="This page isn't open to you"
      message={`${from ? `${pageName(from)} ` : "This page "}is for other roles${as ? ` — you're signed in as ${as}` : ""}. If you need it, ask ${user?.role === "branchAdmin" ? "the owner" : "your branch admin or the owner"}.`}
      actions={[
        { label: "Go back", icon: ArrowLeft, onClick: () => router.back() },
        { label: "Home", icon: House, href: "/", primary: true },
      ]}
    />
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={null}>
      <Unauthorized />
    </Suspense>
  );
}
