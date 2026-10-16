// toast / confirmDialog / promptDialog: callable from anywhere, shown by <UIProvider>.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import UIProvider from "@/app/components/ui/UIProvider";
import { toast, confirmDialog, promptDialog } from "@/app/components/ui/notify";

const mount = () => render(<UIProvider><div>app</div></UIProvider>);

describe("notify", () => {
  afterEach(cleanup);

  it("shows a toast called from plain code", async () => {
    mount();
    act(() => {
      toast.success("Sale saved", { description: "RM 1,600.00" });
    });
    expect(await screen.findByText("Sale saved")).toBeTruthy();
    expect(screen.getByText("RM 1,600.00")).toBeTruthy();
  });

  it("confirmDialog resolves true when confirmed and false when cancelled", async () => {
    mount();
    let answer;
    act(() => {
      confirmDialog({ title: "Delete this cost entry?", message: "This cannot be undone.", danger: true }).then((a) => (answer = a));
    });
    expect(await screen.findByText("Delete this cost entry?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(answer).toBe(true));

    act(() => {
      confirmDialog("Run it?").then((a) => (answer = a));
    });
    await screen.findByText("Run it?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(answer).toBe(false));
  });

  it("promptDialog gives the typed text, or null when cancelled", async () => {
    mount();
    let answer = "unset";
    act(() => {
      promptDialog({ title: "Reason or note", label: "Optional" }).then((a) => (answer = a));
    });
    const input = await screen.findByLabelText("Optional");
    fireEvent.change(input, { target: { value: "Paid twice" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(answer).toBe("Paid twice"));

    act(() => {
      promptDialog({ title: "Reason again" }).then((a) => (answer = a));
    });
    await screen.findByText("Reason again");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(answer).toBe(null));
  });

  it("asks one question at a time, in order", async () => {
    mount();
    const answers = [];
    act(() => {
      confirmDialog("First?").then((a) => answers.push(["first", a]));
      confirmDialog("Second?").then((a) => answers.push(["second", a]));
    });
    await screen.findByText("First?");
    expect(screen.queryByText("Second?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Second?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(answers).toEqual([["first", true], ["second", false]]));
  });
});
