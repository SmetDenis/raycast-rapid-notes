function ensureTrailingNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}

/** Append a line to the end of the file, adding a trailing newline if missing. */
export function appendToEnd(content: string, line: string): string {
  if (content === "") return line + "\n";
  return ensureTrailingNewline(content) + line + "\n";
}

// Matches an H1 heading line ("# ..."); "## ..." and "#tag" do not match.
const H1 = /^#\s/;

/**
 * Insert `line` at the end of the section owned by the exact H1 `# {heading}`.
 * The section runs until the next H1 (sub-headings stay inside it); the line is
 * placed after the last non-blank line of the section. If the heading is absent,
 * a new H1 section is created at the end of the file.
 */
export function appendUnderHeading(
  content: string,
  heading: string,
  line: string,
): string {
  const target = `# ${heading}`;
  const lines = content.split("\n");
  const headingIndex = lines.findIndex((l) => l.trim() === target);

  if (headingIndex === -1) {
    if (content.trim() === "") return `${target}\n${line}\n`;
    return `${ensureTrailingNewline(content)}\n${target}\n${line}\n`;
  }

  let sectionEnd = lines.length;
  for (let j = headingIndex + 1; j < lines.length; j++) {
    if (H1.test(lines[j])) {
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
