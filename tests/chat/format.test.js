import { describe, expect, it } from "vitest";
import { blocks, inline, plainText, toggleList, toggleMark } from "@/lib/chat/format";

const pieces = (s) => inline(s).map((p) => [p.text, Object.keys(p).filter((k) => k !== "text").sort().join("+")]);

describe("reading formatting", () => {
  it("bold, italic, struck and code", () => {
    expect(pieces("this is *very* important")).toEqual([["this is ", ""], ["very", "bold"], [" important", ""]]);
    expect(pieces("_please_ check")).toEqual([["please", "italic"], [" check", ""]]);
    expect(pieces("~cancelled~ moved")).toEqual([["cancelled", "strike"], [" moved", ""]]);
    expect(pieces("run `npm start` now")).toEqual([["run ", ""], ["npm start", "code"], [" now", ""]]);
  });
  it("marks inside marks; code stays as written", () => {
    expect(pieces("*_both_*")).toEqual([["both", "bold+italic"]]);
    expect(pieces("`*not bold*`")).toEqual([["*not bold*", "code"]]);
  });
  it("leaves sums, odd stars and web addresses alone", () => {
    expect(pieces("2 * 3 * 4 = 24")).toEqual([["2 * 3 * 4 = 24", ""]]);
    expect(pieces("a *lonely star")).toEqual([["a *lonely star", ""]]);
    expect(pieces("see https://x.com/a_b_c ok")).toEqual([["see ", ""], ["https://x.com/a_b_c", "link"], [" ok", ""]]);
    expect(pieces("file_name_here")).toEqual([["file_name_here", ""]]);
  });
  it("lists, numbers and quotes as blocks; plain lines stay together", () => {
    const b = blocks("Today:\n- rice\n- oil\n1. clean\n2. count cash\n> from the owner\nthanks");
    expect(b.map((x) => x.type)).toEqual(["p", "ul", "ol", "quote", "p"]);
    expect(b[1].items).toHaveLength(2);
    expect(b[2].start).toBe(1);
    expect(blocks("line one\nline two")).toHaveLength(1);
  });
  it("previews without the marks", () => {
    expect(plainText("*Stock* low:\n- _rice_\n- oil")).toBe("Stock low: • rice • oil");
  });
});

describe("writing with the toolbar", () => {
  it("wraps the selection, and takes the mark off again", () => {
    const on = toggleMark("make this bold", 5, 9, "*");
    expect(on).toEqual({ text: "make *this* bold", start: 6, end: 10 });
    expect(toggleMark(on.text, on.start, on.end, "*").text).toBe("make this bold");
  });
  it("keeps spaces outside the marks; with nothing selected, puts the cursor between them", () => {
    expect(toggleMark("say hi ", 4, 7, "_").text).toBe("say _hi_ ");
    expect(toggleMark("ab", 1, 1, "*")).toEqual({ text: "a**b", start: 2, end: 2 });
  });
  it("turns lines into a list and back", () => {
    const on = toggleList("rice\noil", 0, 8, "ul");
    expect(on.text).toBe("- rice\n- oil");
    expect(toggleList(on.text, 0, on.text.length, "ul").text).toBe("rice\noil");
    expect(toggleList("a\nb", 0, 3, "ol").text).toBe("1. a\n2. b");
  });
});
