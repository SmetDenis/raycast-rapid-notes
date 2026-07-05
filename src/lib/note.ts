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
  body: string;
}

/** Compose a full new note: frontmatter, a blank line, the body, trailing newline. */
export function buildNewNote({
  created,
  tags,
  title,
  body,
}: NewNoteInput): string {
  const fm = buildFrontmatter({ created, tags, title });
  const b = body.replace(/\n+$/, "");
  return b === "" ? `${fm}\n` : `${fm}\n\n${b}\n`;
}
