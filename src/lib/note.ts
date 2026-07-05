import { buildFrontmatter } from "./frontmatter";
import { appendToEnd, appendUnderHeading } from "./markdown";

/**
 * Append a rendered line to file content: to the end when no heading is
 * configured, otherwise under the given H1 heading. A leading `#` in the
 * heading preference is tolerated.
 */
export function applyAppend(
  content: string,
  heading: string,
  line: string,
): string {
  const h = heading.trim().replace(/^#+\s*/, "");
  return h === ""
    ? appendToEnd(content, line)
    : appendUnderHeading(content, h, line);
}

export interface NewNoteInput {
  created: string;
  tags: string[];
  title: string;
  sourceUrl: string;
  body: string;
}

/**
 * Compose a full new note: frontmatter, then the body VERBATIM on the next line — no
 * blank line between the closing `---` and the body (Obsidian's native format). The
 * body's intentional trailing/internal newlines are preserved (never trimmed); a single
 * trailing newline is added only when the body lacks one. A blank body is omitted.
 */
export function buildNewNote({
  created,
  tags,
  title,
  sourceUrl,
  body,
}: NewNoteInput): string {
  const fm = buildFrontmatter({ created, tags, title, sourceUrl });
  if (body.trim() === "") return `${fm}\n`;
  const withNewline = body.endsWith("\n") ? body : `${body}\n`;
  return `${fm}\n${withNewline}`;
}
