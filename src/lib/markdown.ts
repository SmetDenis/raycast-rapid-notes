function ensureTrailingNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}

/** Append a line to the end of the file, adding a trailing newline if missing. */
export function appendToEnd(content: string, line: string): string {
  if (content === "") return line + "\n";
  return ensureTrailingNewline(content) + line + "\n";
}

// Matches any ATX heading ("# ..." through "###### ..."), capturing its level
// (count of leading `#`) and text. A `#` with no following space ("#tag") and an
// empty heading ("# ") are not headings.
const HEADING = /^(#{1,6})\s+(\S.*?)\s*$/;

interface Heading {
  level: number;
  text: string;
}

/** Parse a line as an ATX heading, or return null when it is not one. */
function parseHeading(line: string): Heading | null {
  const m = HEADING.exec(line);
  return m ? { level: m[1].length, text: m[2] } : null;
}

/**
 * Insert `line` at the end of the section owned by the heading
 * `{'#'×level} {text}`, matched case-insensitively at the EXACT level. The
 * section runs until the next heading of ANY level; the line is placed after the
 * last non-blank line of the section. If the heading is absent, a new section at
 * `level` is created at the end of the file with `text` written verbatim.
 */
export function appendUnderHeading(
  content: string,
  level: number,
  text: string,
  line: string,
): string {
  const target = `${"#".repeat(level)} ${text}`;
  const wanted = text.toLowerCase();
  const lines = content.split("\n");
  const headingIndex = lines.findIndex((l) => {
    const h = parseHeading(l);
    return h !== null && h.level === level && h.text.toLowerCase() === wanted;
  });

  if (headingIndex === -1) {
    if (content.trim() === "") return `${target}\n${line}\n`;
    return `${ensureTrailingNewline(content)}\n${target}\n${line}\n`;
  }

  let sectionEnd = lines.length;
  for (let j = headingIndex + 1; j < lines.length; j++) {
    if (parseHeading(lines[j]) !== null) {
      sectionEnd = j;
      break;
    }
  }

  let insertPos = headingIndex + 1;
  for (let k = headingIndex + 1; k < sectionEnd; k++) {
    if (lines[k].trim() !== "") insertPos = k + 1;
  }

  lines.splice(insertPos, 0, line);
  return ensureTrailingNewline(lines.join("\n"));
}

/**
 * Indent the continuation lines (2..n) of a single Markdown list item by
 * `spaces` spaces, so a multi-line item stays inside the bullet. The first
 * line and any blank lines are left untouched (no trailing whitespace).
 */
export function indentContinuation(text: string, spaces = 4): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l, i) => (i === 0 || l === "" ? l : pad + l))
    .join("\n");
}

/**
 * Append `line` under a date sub-heading (`groupText`) inside the section owned
 * by `parent`, auto-creating the group (and the parent) when missing.
 *
 * - `parent === null` (no configured heading): the group is a top-level H1 at the
 *   file end. This reduces to `appendUnderHeading` at level 1 — list items are not
 *   headings, so its "next heading of any level" boundary coincides with "next H1".
 * - Otherwise the parent section (heading level L) ends at the next heading of level
 *   ≤ L, so child date groups (level L+1) do NOT close it. The group is matched at
 *   level L+1 by exact text (case-insensitively); when absent it is appended to the
 *   end of the parent section, preceded by a blank line only when that section
 *   already had content. Duplicate parent/group headings resolve to the first.
 *
 * Level is clamped to 6 (max ATX depth); a parent at H6 is unsupported (the group
 * would collide at the same level) — configure a shallower checklist heading.
 */
export function appendUnderDateGroup(
  content: string,
  parent: Heading | null,
  groupText: string,
  line: string,
): string {
  if (parent === null) {
    return appendUnderHeading(content, 1, groupText, line);
  }

  const { level: L, text: T } = parent;
  const groupLevel = Math.min(L + 1, 6);
  const wantedParent = T.toLowerCase();
  const wantedGroup = groupText.toLowerCase();
  const lines = content.split("\n");

  const parentIdx = lines.findIndex((l) => {
    const h = parseHeading(l);
    return h !== null && h.level === L && h.text.toLowerCase() === wantedParent;
  });

  // Parent missing: create parent + group + line at the end (blank line before,
  // except in an empty file — mirroring appendUnderHeading's "\n{target}\n...").
  if (parentIdx === -1) {
    const block =
      `${"#".repeat(L)} ${T}\n` +
      `${"#".repeat(groupLevel)} ${groupText}\n` +
      line;
    if (content.trim() === "") return `${block}\n`;
    return `${ensureTrailingNewline(content)}\n${block}\n`;
  }

  // The parent section ends at the next heading of level ≤ L.
  let parentEnd = lines.length;
  for (let j = parentIdx + 1; j < lines.length; j++) {
    const h = parseHeading(lines[j]);
    if (h !== null && h.level <= L) {
      parentEnd = j;
      break;
    }
  }

  // Find the date group (level L+1, exact text) inside the parent section.
  let groupIdx = -1;
  for (let j = parentIdx + 1; j < parentEnd; j++) {
    const h = parseHeading(lines[j]);
    if (
      h !== null &&
      h.level === groupLevel &&
      h.text.toLowerCase() === wantedGroup
    ) {
      groupIdx = j;
      break;
    }
  }

  if (groupIdx !== -1) {
    // Group present: insert after its last non-blank line (sub-section ends at
    // the next heading of level ≤ groupLevel, within the parent section).
    let groupEnd = parentEnd;
    for (let j = groupIdx + 1; j < parentEnd; j++) {
      const h = parseHeading(lines[j]);
      if (h !== null && h.level <= groupLevel) {
        groupEnd = j;
        break;
      }
    }
    let insertPos = groupIdx + 1;
    for (let k = groupIdx + 1; k < groupEnd; k++) {
      if (lines[k].trim() !== "") insertPos = k + 1;
    }
    lines.splice(insertPos, 0, line);
    return ensureTrailingNewline(lines.join("\n"));
  }

  // Group missing: append a new group at the end of the parent section, after
  // its last non-blank line. Prefix a blank line only when the section had content.
  let lastContent = parentIdx;
  for (let k = parentIdx + 1; k < parentEnd; k++) {
    if (lines[k].trim() !== "") lastContent = k;
  }
  const groupHeading = `${"#".repeat(groupLevel)} ${groupText}`;
  const block =
    lastContent > parentIdx ? ["", groupHeading, line] : [groupHeading, line];
  lines.splice(lastContent + 1, 0, ...block);
  return ensureTrailingNewline(lines.join("\n"));
}
