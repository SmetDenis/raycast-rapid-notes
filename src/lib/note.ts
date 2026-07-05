import { buildFrontmatter } from "./frontmatter";
import { appendToEnd, appendUnderHeading } from "./markdown";

interface ParsedHeading {
  level: number;
  text: string;
}

/**
 * Interpret the append-heading preference: leading `#`s set the level (bare text
 * defaults to H1); the rest is the verbatim heading text (markdown allowed).
 * Returns null for an empty preference — meaning "append to the end of the file".
 * A missing space after the hashes (`###Title`) is tolerated.
 */
function parseHeadingPref(pref: string): ParsedHeading | null {
  const trimmed = pref.trim();
  if (trimmed === "") return null;
  const m = /^(#{1,6})\s*(\S.*?)\s*$/.exec(trimmed);
  return m ? { level: m[1].length, text: m[2] } : { level: 1, text: trimmed };
}

/**
 * Append a rendered line to file content: to the end when no heading is
 * configured, otherwise under the configured heading at its parsed level,
 * matched case-insensitively.
 */
export function applyAppend(
  content: string,
  heading: string,
  line: string,
): string {
  const parsed = parseHeadingPref(heading);
  return parsed === null
    ? appendToEnd(content, line)
    : appendUnderHeading(content, parsed.level, parsed.text, line);
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
