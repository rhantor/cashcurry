// MoneyInput fills from the cents, like a card terminal: 1 → 0.01, 12 → 0.12, 125 → 1.25.
import { useState } from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MoneyInput, { amountOf, digitsOf } from "@/app/components/entry/MoneyInput";

function Harness({ start = "", currency = "RM", onChange }) {
  const [v, setV] = useState(start);
  return (
    <>
      <MoneyInput
        aria-label="amount"
        currency={currency}
        value={v}
        onValueChange={(x) => {
          setV(x);
          onChange?.(x);
        }}
      />
      <output data-testid="value">{v}</output>
    </>
  );
}

const box = () => screen.getByLabelText("amount");
const value = () => screen.getByTestId("value").textContent;
// What a keyboard does to the box: the new text, which the field reads as digits.
const typeDigit = (d) => fireEvent.change(box(), { target: { value: box().value + d } });
const backspace = () => fireEvent.change(box(), { target: { value: box().value.slice(0, -1) } });

describe("MoneyInput (cents first)", () => {
  afterEach(cleanup);

  it("fills from the right as digits are typed", () => {
    render(<Harness />);
    const seen = [];
    for (const d of "12550") {
      typeDigit(d);
      seen.push(box().value);
    }
    expect(seen).toEqual(["0.01", "0.12", "1.25", "12.55", "125.50"]);
    expect(value()).toBe("125.50");
  });

  it("backspace takes the last digit off, down to empty", () => {
    render(<Harness start="1.25" />);
    backspace();
    expect(box().value).toBe("0.12");
    backspace();
    backspace();
    expect(box().value).toBe("");
    expect(value()).toBe("");
  });

  it("typing over a selected amount starts a new one", () => {
    render(<Harness start="800" />);
    fireEvent.change(box(), { target: { value: "9" } }); // all selected, "9" typed
    expect(box().value).toBe("0.09");
  });

  it("shows a saved amount with two decimals and grouping", () => {
    render(<Harness start="1200.5" />);
    expect(box().value).toBe("1,200.50");
  });

  it("reads a pasted amount as written", () => {
    render(<Harness />);
    fireEvent.paste(box(), { clipboardData: { getData: () => "RM 50" } });
    expect(value()).toBe("50.00");
  });

  it("groups taka the Bangladeshi way", () => {
    render(<Harness start="123456.75" currency="BDT" />);
    expect(box().value).toBe("1,23,456.75");
  });

  it("helpers", () => {
    expect(digitsOf("0.05")).toBe("5");
    expect(digitsOf("0.00")).toBe("");
    expect(digitsOf("1,234.50")).toBe("123450");
    expect(amountOf("125")).toBe("1.25");
    expect(amountOf("")).toBe("");
  });
});
