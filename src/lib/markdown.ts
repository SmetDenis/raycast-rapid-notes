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
