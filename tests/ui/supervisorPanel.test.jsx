// "My requests": each request shows where it has got to — waiting, approved
// (not paid out), paid out, rejected — the filters count them, and one still
// waiting can be cancelled. The list comes from the requests engine.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { toRequest } from "@/lib/requests/model";

const me = { uid: "u1", username: "kl_supervisor", companyId: "c1", branchId: "b1", role: "supervisor" };
const by = { uid: "u1", name: "KL Supervisor" };
const requests = [
  toRequest("advance", { id: "a1", staffName: "Kumar Raj", amount: 150, date: "2026-10-16", status: "pending", paidOut: null, createdBy: by, createdAt: "2026-10-16T09:00:00Z" }),
  toRequest("staffLoan", { id: "l1", staffName: "Siti Aminah", amount: 600, durationMonths: 6, date: "2026-10-14", status: "approved", paidOut: { date: "2026-10-15" }, createdBy: by, approvedBy: { name: "KL Admin" }, createdAt: "2026-10-14T09:00:00Z" }),
  toRequest("advance", { id: "a2", staffName: "Ali Hassan", amount: 100, date: "2026-10-12", status: "approved", paidOut: null, createdBy: by, approvedBy: { name: "KL Manager" }, createdAt: "2026-10-12T09:00:00Z" }),
  toRequest("leave", { id: "v1", staffName: "Ravi", leaveKind: "annual", from: "2026-10-01", to: "2026-10-02", days: 2, status: "rejected", createdBy: by, rejectedBy: { step: "branch", name: "KL Admin" }, rejectReason: "Short-staffed", createdAt: "2026-10-01T09:00:00Z" }),
];
const decide = vi.fn(() => ({ unwrap: () => Promise.resolve({}) }));

vi.mock("@/app/hooks/useSession", () => ({ default: () => ({ user: me, companyId: "c1", branchId: "b1", role: "supervisor" }) }));
vi.mock("@/lib/requests/useApprovalPolicy", () => ({ default: () => ({ ownerApprovalAbove: 0 }) }));
vi.mock("@/app/hooks/useCurrency", () => ({ default: () => "MYR" }));
vi.mock("@/lib/redux/api/requestsApiSlice", () => ({
  useGetRequestsQuery: () => ({ data: requests, isLoading: false }),
  useDecideRequestMutation: () => [decide],
  useAddLeaveMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock("@/lib/redux/api/notificationApiSlice", () => ({ useAddNotificationMutation: () => [vi.fn()] }));

const { default: SupervisorPanel } = await import("@/app/supervisor-panel/page.jsx");

afterEach(cleanup);

describe("My requests", () => {
  it("lists my requests, newest first, each with its stage", () => {
    render(<SupervisorPanel />);
    const names = screen.getAllByText(/Kumar Raj|Ali Hassan|Siti Aminah|Ravi/).map((n) => n.textContent);
    expect(names).toEqual(["Kumar Raj", "Siti Aminah", "Ali Hassan", "Ravi"]);
    expect(screen.getAllByText("Waiting").length).toBeGreaterThan(0);
    expect(screen.getByText(/Why: Short-staffed/)).toBeTruthy();
  });

  it("filters by stage", () => {
    render(<SupervisorPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Rejected/ }));
    expect(screen.getByText("Ravi")).toBeTruthy();
    expect(screen.queryByText("Kumar Raj")).toBeNull();
  });

  it("only the one still waiting can be cancelled", () => {
    render(<SupervisorPanel />);
    expect(screen.getAllByRole("button", { name: /Cancel request/ })).toHaveLength(1);
  });
});
