// Ctrl+K search: typing finds pages, arrow keys move, Enter opens.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import CommandPalette from "@/app/components/shell/CommandPalette";
import { pagesFor } from "@/app/components/shell/navigation";

const setup = (props = {}) => {
  const onClose = vi.fn();
  const onSwitchBranch = vi.fn();
  const onSignOut = vi.fn();
  render(
    <CommandPalette
      open
      onClose={onClose}
      pages={pagesFor("manager")}
      branches={[]}
      activeBranchId="kl"
      onSwitchBranch={onSwitchBranch}
      onSignOut={onSignOut}
      {...props}
    />
  );
  return { onClose, onSwitchBranch, onSignOut, input: screen.getByPlaceholderText(/search pages/i) };
};

describe("command palette", () => {
  afterEach(cleanup);
  beforeEach(() => {
    push.mockClear();
    localStorage.clear();
  });

  it("finds a page from a few letters and opens it with Enter", () => {
    const { input, onClose } = setup();
    fireEvent.change(input, { target: { value: "cost rep" } });
    expect(screen.getByText("Cost Report")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/reports/cost-report");
  });

  it("moves with the arrow keys", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "report" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledTimes(1);
    const [first, second] = pagesFor("manager").filter((p) => `${p.label} ${p.parent || ""} ${p.section}`.toLowerCase().includes("report"));
    expect(push).toHaveBeenCalledWith(second.path);
    expect(first.path).not.toBe(second.path);
  });

  it("only shows pages the role can open", () => {
    const { input } = setup({ pages: pagesFor("cashier") });
    fireEvent.change(input, { target: { value: "payroll" } });
    expect(screen.queryByText("Run Payroll")).toBeNull();
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it("switches branch and signs out", () => {
    const branches = [{ id: "kl", name: "Demo Branch KL" }, { id: "pj", name: "Demo Branch PJ" }];
    const { input, onSwitchBranch, onSignOut } = setup({ branches });
    fireEvent.change(input, { target: { value: "pj" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSwitchBranch).toHaveBeenCalledWith(branches[1]);
    fireEvent.change(input, { target: { value: "sign out" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSignOut).toHaveBeenCalled();
  });
});
