// "My requests": each request shows where it has got to — waiting, approved
// (not handed over), handed over, rejected — and the filters count them.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const me = { uid: "u1", username: "kl_supervisor", companyId: "c1", branchId: "b1", role: "supervisor" };
const by = { uid: "u1" };
const advances = [
  { id: "a1", staffName: "Kumar Raj", amount: 150, date: "2026-10-16", status: "pending", createdBy: by },
  { id: "a2", staffName: "Ali Hassan", amount: 100, date: "2026-10-12", status: "approved", paidOut: null, createdBy: by, approvedBy: { name: "kl_manager", role: "manager" } },
  { id: "a3", staffName: "Someone Else", amount: 999, date: "2026-10-10", status: "pending", createdBy: { uid: "other" } },
];
const loans = [
  { id: "l1", staffName: "Siti Aminah", amount: 600, durationMonths: 6, date: "2026-10-14", status: "approved", paidOut: { date: "2026-10-15" }, createdBy: by, approvedBy: { name: "kl_admin" } },
  { id: "l2", staffName: "Ravi", amount: 300, date: "2026-10-01", status: "rejected", createdBy: by, approvedBy: { name: "kl_admin" } },
];

vi.mock("@/lib/session", () => ({ getSessionUser: () => me }));
vi.mock("@/app/hooks/useCurrency", () => ({ default: () => "RM" }));
vi.mock("@/lib/redux/api/AdvanceApiSlice", () => ({ useGetAdvanceEntriesQuery: () => ({ data: advances, isLoading: false }) }));
vi.mock("@/lib/redux/api/staffLoanApiSlice", () => ({ useGetStaffLoansQuery: () => ({ data: loans, isLoading: false }) }));

const { default: SupervisorPanel } = await import("@/app/supervisor-panel/page.jsx");

afterEach(cleanup);

describe("My requests", () => {
  it("lists only my requests, newest first, each with its stage", () => {
    render(<SupervisorPanel />);
    const names = screen.getAllByText(/Kumar Raj|Ali Hassan|Siti Aminah|Ravi|Someone Else/).map((n) => n.textContent);
    expect(names).toEqual(["Kumar Raj", "Siti Aminah", "Ali Hassan", "Ravi"]);
    expect(screen.getAllByText("Waiting").length).toBeGreaterThan(0);
    expect(screen.getByText(/handed over Thu, 15 Oct 2026/)).toBeTruthy();
    expect(screen.queryByText(/999/)).toBeNull();
  });

  it("filters by stage", () => {
    render(<SupervisorPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Rejected/ }));
    expect(screen.getByText("Ravi")).toBeTruthy();
    expect(screen.queryByText("Kumar Raj")).toBeNull();
  });
});
