import {
  buildFrontmatter,
  parseExtraFrontmatter,
  type FrontmatterField,
} from "./frontmatter";
import {
  appendToEnd,
  appendUnderDateGroup,
  appendUnderHeading,
} from "./markdown";

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

/**
 * Like `applyAppend`, but groups items under an auto-created/found date sub-heading
 * (`groupText`) inside the configured heading's section. Used only by append-checklist;
 * a null heading pref groups at the top level (see lib/markdown.appendUnderDateGroup).
 */
export function applyGroupedAppend(
  content: string,
  heading: string,
  groupText: string,
  line: string,
): string {
  return appendUnderDateGroup(
    content,
    parseHeadingPref(heading),
    groupText,
    line,
  );
}

export interface NewNoteInput {
  extra: FrontmatterField[];
  created: string;
  title: string;
  project: string;
  tags: string[];
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
  extra,
  created,
  title,
  project,
  tags,
  sourceUrl,
  body,
}: NewNoteInput): string {
  const fm = buildFrontmatter({
    extra,
    created,
    title,
    project,
    tags,
    sourceUrl,
  });
  if (body.trim() === "") return `${fm}\n`;
  const withNewline = body.endsWith("\n") ? body : `${body}\n`;
  return `${fm}\n${withNewline}`;
}

/**
 * Compose a new note's title: prefix `{project}: ` only when a project is given, and fall
 * back to `dateFallback` (a pre-formatted `{date} {time}`) when the title is empty — so a
 * create always has a title. Project and title are trimmed.
 */
export function composeCreateTitle({
  project,
  title,
  dateFallback,
}: {
  project: string;
  title: string;
  dateFallback: string;
}): string {
  const base = title.trim() || dateFallback;
  const p = project.trim();
  return p ? `${p}: ${base}` : base;
}

/**
 * True only when a create has nothing worth saving — content, title and project are all
 * blank. A title-only (or project-only) capture is valid and must NOT count as empty. This
 * runs on the captured/merged content, never on the fallback-filled title, so an empty
 * hotkey press cannot silently produce a junk file.
 */
export function isEmptyCapture({
  content,
  title,
  project,
}: {
  content: string;
  title: string;
  project: string;
}): boolean {
  return content.trim() === "" && title.trim() === "" && project.trim() === "";
}

export interface CreateFileInput {
  /** Raw configurable frontmatter pref, e.g. `type: task; task_status: active`. Throws when malformed. */
  frontmatterPref: string;
  created: string;
  /** Raw user title (empty → date/time fallback). */
  title: string;
  project: string;
  /** Pre-formatted `{date} {time}` used when the title is empty. */
  dateFallback: string;
  tags: string[];
  sourceUrl: string;
  /** Already-rendered body. */
  body: string;
}

/**
 * Compose a full create-note file from captured input: parse the configurable frontmatter
 * pref into structural extra fields (throws LOUDLY on a malformed/reserved/duplicate key —
 * the caller surfaces it and aborts), synthesise the title (project prefix + date/time
 * fallback), and build the note. Keeps the command adapter thin: capture → this → write.
 */
export function buildCreateFile({
  frontmatterPref,
  created,
  title,
  project,
  dateFallback,
  tags,
  sourceUrl,
  body,
}: CreateFileInput): string {
  const extra = parseExtraFrontmatter(frontmatterPref);
  const composedTitle = composeCreateTitle({ project, title, dateFallback });
  return buildNewNote({
    extra,
    created,
    title: composedTitle,
    project: project.trim(),
    tags,
    sourceUrl,
    body,
  });
}
