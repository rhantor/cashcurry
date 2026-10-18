// lib/chat/format.js — formatting in chat messages (roadmap 4.4), the way
// WhatsApp and Slack write it, so people already know it:
//
//   *bold*   _italic_   ~struck~   `code`   https://links
//   - item / • item     (a bulleted list)
//   1. item             (a numbered list)
//   > quoted line
//
// Pure: turns a message's text into blocks of inline pieces; the screen
// draws them (never as HTML, so nothing typed can run as code).

const MARKS = { "*": "bold", _: "italic", "~": "strike", "`": "code" };

/**
 * One line's inline pieces: [{ text, bold?, italic?, strike?, code?, link? }].
 * A mark counts only around words (`*so*` yes, `2 * 3 * 4` no), and links are
 * left as they are (an underscore in a web address is not italic).
 */
export function inline(line) {
  const out = [];
  const push = (text, style = {}) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && !last.link && !style.link && JSON.stringify({ ...last, text: "" }) === JSON.stringify({ ...style, text: "" })) last.text += text;
    else out.push({ text, ...style });
  };

  const walk = (s, style) => {
    let i = 0;
    let plain = "";
    while (i < s.length) {
      // a link: up to the next space, as it is
      const link = /^https?:\/\/[^\s]+/.exec(s.slice(i));
      if (link && (i === 0 || /\s/.test(s[i - 1]))) {
        push(plain, style);
        plain = "";
        push(link[0], { ...style, link: true });
        i += link[0].length;
        continue;
      }
      const ch = s[i];
      const kind = MARKS[ch];
      const before = i === 0 ? " " : s[i - 1];
      if (kind && !style[kind] && /[\s([{"'“]|^$/.test(before) && s[i + 1] && !/\s/.test(s[i + 1])) {
        // find the closing mark: right after a non-space, followed by a non-word
        let j = i + 1;
        let end = -1;
        while ((j = s.indexOf(ch, j)) !== -1) {
          const after = s[j + 1] ?? " ";
          if (!/\s/.test(s[j - 1]) && j > i + 1 && /[\s.,!?;:)\]}"'”]|^$/.test(after)) {
            end = j;
            break;
          }
          j += 1;
        }
        if (end !== -1) {
          push(plain, style);
          plain = "";
          const inner = s.slice(i + 1, end);
          // code is taken as written; the others may hold more marks
          if (kind === "code") push(inner, { ...style, code: true });
          else walk(inner, { ...style, [kind]: true });
          i = end + 1;
          continue;
        }
      }
      plain += ch;
      i += 1;
    }
    push(plain, style);
  };

  walk(String(line), {});
  return out;
}

/**
 * The message as blocks: { type: "p", lines: [pieces[]] } | { type: "ul" |
 * "ol", items: [pieces[]], start } | { type: "quote", lines: [pieces[]] }.
 * Plain lines next to each other stay one paragraph (with line breaks).
 */
export function blocks(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(raw);
    const number = /^\s*(\d{1,3})[.)]\s+(.*)$/.exec(raw);
    const quote = /^\s*>\s?(.*)$/.exec(raw);
    const last = out[out.length - 1];
    if (bullet) {
      if (last?.type === "ul") last.items.push(inline(bullet[1]));
      else out.push({ type: "ul", items: [inline(bullet[1])] });
    } else if (number) {
      if (last?.type === "ol") last.items.push(inline(number[2]));
      else out.push({ type: "ol", start: Number(number[1]), items: [inline(number[2])] });
    } else if (quote) {
      if (last?.type === "quote") last.lines.push(inline(quote[1]));
      else out.push({ type: "quote", lines: [inline(quote[1])] });
    } else if (last?.type === "p") {
      last.lines.push(inline(raw));
    } else {
      out.push({ type: "p", lines: [inline(raw)] });
    }
  }
  return out;
}

/** The words without the marks — for previews, pushes and search. */
export function plainText(text) {
  return blocks(text)
    .map((b) => {
      const lines = b.type === "ul" || b.type === "ol" ? b.items.map((it, i) => `${b.type === "ul" ? "•" : `${(b.start || 1) + i}.`} ${it.map((p) => p.text).join("")}`) : b.lines.map((l) => l.map((p) => p.text).join(""));
      return lines.join(" ");
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── writing: what the toolbar and shortcuts do to the text box ───────────────

/**
 * Wrap the selected words in a mark (or take it off if already there).
 * Returns { text, start, end } — the new text and where the selection goes.
 */
export function toggleMark(text, start, end, mark) {
  const sel = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);
  if (before.endsWith(mark) && after.startsWith(mark)) {
    return { text: before.slice(0, -mark.length) + sel + after.slice(mark.length), start: start - mark.length, end: end - mark.length };
  }
  if (!sel) {
    // nothing selected: put the marks in and the cursor between them
    return { text: before + mark + mark + after, start: start + mark.length, end: start + mark.length };
  }
  // keep spaces at the ends outside the marks, so the mark still counts
  const lead = sel.match(/^\s*/)[0];
  const trail = sel.match(/\s*$/)[0];
  const core = sel.slice(lead.length, sel.length - trail.length);
  const next = before + lead + mark + core + mark + trail + after;
  const s = start + lead.length + mark.length;
  return { text: next, start: s, end: s + core.length };
}

/** Make the selected lines a list ("- " or "1. "), or plain again. */
export function toggleList(text, start, end, kind = "ul") {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", end);
  const lineEnd = nl === -1 ? text.length : nl;
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const is = kind === "ul" ? (l) => /^\s*[-•]\s+/.test(l) : (l) => /^\s*\d{1,3}[.)]\s+/.test(l);
  const strip = (l) => l.replace(/^\s*([-•]|\d{1,3}[.)])\s+/, "");
  const off = lines.every((l) => is(l));
  const next = lines.map((l, i) => (off ? strip(l) : `${kind === "ul" ? "- " : `${i + 1}. `}${strip(l)}`)).join("\n");
  const out = text.slice(0, lineStart) + next + text.slice(lineEnd);
  return { text: out, start: lineStart, end: lineStart + next.length };
}
