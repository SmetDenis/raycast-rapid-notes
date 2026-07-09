function ensureTrailingNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}

/**
 * Index of the first body line, i.e. just past a leading `---`…`---` YAML frontmatter
 * block; 0 when there is none (or the block is unterminated). Mirrors the frontmatter
 * detection in `frontmatter.upsertUpdatedField` so top-of-file inserts never land above
 * the frontmatter (which would corrupt it and the later `updated` refresh).
 */
function bodyStart(lines: string[]): number {
  if (lines[0] !== "---") return 0;
  const end = lines.indexOf("---", 1);
  return end === -1 ? 0 : end + 1;
}

/**
 * Prepend a line to the top of the file, below any YAML frontmatter block (newest-first).
 * The line (which may be multi-line) is inserted verbatim; a trailing newline is ensured.
 */
export function prependToTop(content: string, line: string): string {
  if (content === "") return line + "\n";
  const lines = content.split("\n");
  lines.splice(bodyStart(lines), 0, line);
  return ensureTrailingNewline(lines.join("\n"));
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
 * Insert `line` at the TOP of the section owned by the heading `{'#'×level} {text}`,
 * matched case-insensitively at the EXACT level — i.e. immediately after the heading line,
 * before the section's existing content (newest-first). If the heading is absent, a new
 * section at `level` is created at the END of the file (one-time bootstrap) with `text`
 * written verbatim.
 */
export function prependUnderHeading(
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

  lines.splice(headingIndex + 1, 0, line);
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
 * Prepend `line` under a date sub-heading (`groupText`) inside the section owned by
 * `parent`, auto-creating the group (and the parent) when missing. Newest-first at BOTH
 * levels: a new day group goes to the top of the list and a new item to the top of its day.
 *
 * - `parent === null` (no configured heading): the group is a top-level H1. A found group
 *   gets the item right after its heading; a missing group is created at the top of the
 *   file, below any frontmatter (before older day groups).
 * - Otherwise the parent section (heading level L) ends at the next heading of level ≤ L,
 *   so child date groups (level L+1) do NOT close it. The group is matched at level L+1 by
 *   exact text (case-insensitively); when found, the item is inserted right after the group
 *   heading (top of the day). When absent, a new group is inserted at the top of the parent
 *   section (right after the parent heading, before older groups), with a trailing blank
 *   line only when the section already had content. Duplicate parent/group headings resolve
 *   to the first. A parent that is MISSING is bootstrapped at the END of the file.
 *
 * Level is clamped to 6 (max ATX depth); a parent at H6 is unsupported (the group
 * would collide at the same level) — configure a shallower checklist heading.
 */
export function prependUnderDateGroup(
  content: string,
  parent: Heading | null,
  groupText: string,
  line: string,
): string {
  const wantedGroup = groupText.toLowerCase();

  if (parent === null) {
    const groupHeading = `# ${groupText}`;
    const lines = content.split("\n");
    const groupIdx = lines.findIndex((l) => {
      const h = parseHeading(l);
      return (
        h !== null && h.level === 1 && h.text.toLowerCase() === wantedGroup
      );
    });
    if (groupIdx !== -1) {
      lines.splice(groupIdx + 1, 0, line);
      return ensureTrailingNewline(lines.join("\n"));
    }
    // Group missing: create it at the top of the file, below any frontmatter.
    if (content === "") return `${groupHeading}\n${line}\n`;
    const at = bodyStart(lines);
    const hasFollowing = lines.slice(at).some((l) => l.trim() !== "");
    const block = hasFollowing
      ? [groupHeading, line, ""]
      : [groupHeading, line];
    lines.splice(at, 0, ...block);
    return ensureTrailingNewline(lines.join("\n"));
  }

  const { level: L, text: T } = parent;
  const groupLevel = Math.min(L + 1, 6);
  const wantedParent = T.toLowerCase();
  const lines = content.split("\n");

  const parentIdx = lines.findIndex((l) => {
    const h = parseHeading(l);
    return h !== null && h.level === L && h.text.toLowerCase() === wantedParent;
  });

  // Parent missing: bootstrap parent + group + line at the END (blank line before,
  // except in an empty file — mirroring prependUnderHeading's "\n{target}\n...").
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
    // Group present: prepend the item right after the group heading (top of the day).
    lines.splice(groupIdx + 1, 0, line);
    return ensureTrailingNewline(lines.join("\n"));
  }

  // Group missing: create a new group at the TOP of the parent section (right after the
  // parent heading, before older groups). Suffix a blank line only when the section had
  // content, mirroring the blank line kept between date groups.
  const groupHeading = `${"#".repeat(groupLevel)} ${groupText}`;
  const hasFollowing = lines
    .slice(parentIdx + 1, parentEnd)
    .some((l) => l.trim() !== "");
  const block = hasFollowing ? [groupHeading, line, ""] : [groupHeading, line];
  lines.splice(parentIdx + 1, 0, ...block);
  return ensureTrailingNewline(lines.join("\n"));
}
