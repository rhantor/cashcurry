"use client";

import { useMemo, useState } from "react";
import { Inbox, ShoppingBag } from "lucide-react";
import { skipToken } from "@reduxjs/toolkit/query";
import useSession from "@/app/hooks/useSession";
import { useBusinessToday } from "@/app/hooks/useRegion";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { presetFilter } from "@/utils/dashboard/dateFilters";
import useBranchData from "@/utils/dashboard/useBranchData";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { useGetCompanyDetailsQuery } from "@/lib/redux/api/authApiSlice";
import { navFor, pagesFor } from "@/app/components/shell/navigation";
import usePendingRequests from "@/app/components/shell/usePendingRequests";
import { Skeleton } from "@/app/components/ui";
import HomeHero from "@/app/components/home/HomeHero";
import { AllPages, Attention, HomeSection, QuickActions } from "@/app/components/home/HomeSections";

import { personName } from "@/lib/people";
const ROLE = {
  owner: "Owner", gm: "General manager", superAdmin: "Super admin", branchAdmin: "Branch admin",
  manager: "Manager", inCharge: "In charge", accountant: "Accountant", cashier: "Cashier", supervisor: "Supervisor",
};

/**
 * Home: today at a glance, what needs doing, one-tap shortcuts, and every
 * page the role can open. People who can see the branch dashboard also see
 * today's money for the branch they're in.
 */
export default function HomePage() {
  const { user, role, companyId, branchId } = useSession();
  const pages = useMemo(() => pagesFor(role), [role]);
  const sections = useMemo(() => navFor(role), [role]);
  const seesMoney = pages.some((p) => p.path === "/dashboard");

  if (!role) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <Skeleton className="h-56 w-full" rounded="rounded-3xl" />
        <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-20" rounded="rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  const props = { user, role, companyId, branchId, pages, sections };
  return seesMoney ? <WithMoney {...props} /> : <Home {...props} />;
}

/** Home for roles that see the branch's money: today's figures come from the dashboard's data. */
function WithMoney(props) {
  const today = useBusinessToday();
  const [filter] = useState(() => presetFilter("week", new Date(), today));
  const currency = useCurrency();
  const { loading, salesTrend, estCashOnHand, totalSales } = useBranchData(filter);
  const sales = salesTrend.find((d) => d.date === today)?.total || 0;
  const figures = {
    loading: loading && !totalSales,
    todayKey: today,
    sales,
    cash: estCashOnHand,
    week: salesTrend,
    money: (v) => formatMoney(v, currency),
  };
  // Today's sales not in yet: a nudge, to the entry form if they can use it.
  const canEnter = props.pages.some((p) => p.path === "/entry-data/sales-entry");
  const nudge =
    !figures.loading && !sales
      ? [{
          icon: ShoppingBag,
          tone: "in",
          title: "Today's sales aren't in yet",
          note: canEnter ? "Add them when the day closes" : "Nothing entered for today so far",
          href: canEnter ? "/entry-data/sales-entry" : "/reports/sales-report",
        }]
      : [];
  return <Home {...props} figures={figures} extra={nudge} />;
}

function Home({ user, role, companyId, branchId, pages, sections, figures = null, extra = [] }) {
  const { data: branch } = useGetSingleBranchQuery(companyId && branchId ? { companyId, branchId } : skipToken);
  const { data: company } = useGetCompanyDetailsQuery(companyId ?? skipToken);
  const pending = usePendingRequests({ companyId, branchId, role });

  const name = user?.name || user?.fullName || personName(user) || "";
  const attention = [
    ...(pending.total > 0
      ? [{
          icon: Inbox,
          tone: "out",
          title: `${pending.total} request${pending.total > 1 ? "s" : ""} waiting`,
          note: "Advances, loans and overtime to approve",
          href: "/requested-panel",
        }]
      : []),
    ...extra,
  ];

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-5 sm:px-6 sm:py-6">
        <HomeHero name={name} role={ROLE[role] || role} branchName={branch?.name} company={company?.name} today={figures} />

        <HomeSection title="Quick actions">
          <QuickActions pages={pages} badges={{ "/requested-panel": pending.total }} />
        </HomeSection>

        <HomeSection title="Needs attention">
          <Attention items={attention} />
        </HomeSection>

        <HomeSection title="Everything else">
          <AllPages sections={sections} />
        </HomeSection>
      </div>
    </div>
  );
}
