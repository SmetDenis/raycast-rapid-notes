import type { CaptureInputs } from "./capture-inputs";
import { joinParts, separatorGlyph } from "./content";
import { formatDate } from "./datetime";
import { uniqueFilename } from "./filename";
import { applyGroupedAppend, buildCreateFile, isEmptyCapture } from "./note";
import { type AppendFormat, chooseAppendFormat } from "./route";
import { TEMPLATES, type TemplateFn } from "./templates";
import { buildTemplateVars } from "./vars";

// Pure capture-to-decision planners: everything the thin @raycast/api adapters (capture.ts,
// rapid-note.tsx) do EXCEPT the actual I/O and UI. They take already-read inputs and return a
// discriminated outcome the adapter switches on. Keeping this in lib (no @raycast/api import)
// makes the real bug-site — content assembly + format routing + rendering + the empty/missing
// branches — unit-testable, which is exactly the layer the previous regression slipped through.

/** Source context a capture may attach (frontmost app + browser tab); "" fields when absent. */
export interface CaptureSource {
  url: string;
  title: string;
  app: string;
}

/** One append target: its file and grouping heading. */
export interface AppendTarget {
  file: string;
  heading: string;
}

/** The two append targets the merged command routes between by capture shape. */
export interface RoutedAppendConfig {
  note: AppendTarget;
  checklist: AppendTarget;
}

/** The rendered append plus everything the adapter needs to write it — no I/O done here. */
export interface AppendWrite {
  kind: "write";
  format: AppendFormat;
  file: string;
  heading: string;
  groupText: string;
  line: string;
  /** Pre-formatted `updated` value for the frontmatter refresh. */
  updated: string;
}

/**
 * Outcome of planning a silent append:
 * - `write`         — render succeeded; the adapter appends `line` and refreshes `updated`.
 * - `emptyTerminal` — nothing captured in a non-AX terminal (a distinct, loud failure).
 * - `emptyGeneric`  — nothing captured elsewhere (`usedClipboard` shapes the HUD text).
 * - `missingTarget` — the routed target file is unset.
 */
export type AppendPlan =
  | AppendWrite
  | { kind: "emptyTerminal" }
  | { kind: "emptyGeneric"; usedClipboard: boolean }
  | { kind: "missingTarget"; format: AppendFormat };

export interface SilentAppendInput {
  args: { text?: string; project?: string };
  inputs: CaptureInputs;
  source: CaptureSource;
  config: RoutedAppendConfig;
  now: Date;
  dateFormat: string;
  /** Raw `mergeSeparator` preference enum (semicolon | space | newline). */
  mergeSeparator: string;
}

/**
 * Plan a silent (no-view) append: merge the typed argument with the read selection/clipboard,
 * classify the shape (multi-line → note block, single line → checklist item), and render the line
 * for the matching target. Returns a discriminated outcome — the adapter does the I/O and UI.
 */
export function planSilentAppend({
  args,
  inputs,
  source,
  config,
  now,
  dateFormat,
  mergeSeparator,
}: SilentAppendInput): AppendPlan {
  const sep = separatorGlyph(mergeSeparator);
  const extra = (args.text ?? "").trim();
  const content = joinParts([extra, inputs.selected, inputs.clipboard], sep);

  if (!content.trim()) {
    if (inputs.inTerminal) return { kind: "emptyTerminal" };
    return { kind: "emptyGeneric", usedClipboard: inputs.usedClipboard };
  }

  const format = chooseAppendFormat(content);
  const target = config[format];
  if (!target.file.trim()) return { kind: "missingTarget", format };

  const vars = buildTemplateVars({
    content,
    extra: args.text ?? "",
    selected: inputs.selected,
    clipboard: inputs.clipboard,
    url: source.url,
    title: source.title,
    app: source.app,
    project: args.project ?? "",
    now,
    dateFormat,
    separator: sep,
  });
  const template =
    format === "note" ? TEMPLATES.appendNote : TEMPLATES.checklist;

  return {
    kind: "write",
    format,
    file: target.file,
    heading: target.heading,
    groupText: `_${vars.date}_`,
    line: template(vars),
    updated: formatDate(now, dateFormat),
  };
}

/** Apply an `AppendWrite` to file content: splice the line under its date group. */
export function renderAppendedFile(current: string, plan: AppendWrite): string {
  return applyGroupedAppend(current, plan.heading, plan.groupText, plan.line);
}

/** The composed create-file plus everything the adapter needs to write it — no I/O done here. */
export interface CreateWrite {
  kind: "write";
  directory: string;
  filename: string;
  file: string;
}

/**
 * Outcome of planning a silent create:
 * - `write`            — composed file + resolved (collision-free) filename; the adapter writes it.
 * - `missingDirectory` — the create directory pref is unset (checked before any capture).
 * - `empty`            — content, title AND project are all blank (a stray hotkey; write nothing).
 *
 * A malformed `frontmatter` pref makes this THROW (via buildCreateFile) — the adapter catches it
 * and surfaces a loud Toast, never silently corrupting YAML.
 */
export type CreatePlan =
  CreateWrite | { kind: "missingDirectory" } | { kind: "empty" };

export interface SilentCreateInput {
  args: { text?: string; project?: string; title?: string };
  inputs: CaptureInputs;
  source: CaptureSource;
  directory: string;
  template: TemplateFn;
  frontmatter: string;
  tags: string[];
  now: Date;
  dateFormat: string;
  filenameDateFormat: string;
  mergeSeparator: string;
  /**
   * Whether a filename already exists in the target directory — the ONLY I/O the create planner
   * needs, injected so the planner stays pure. Defaults to "never collides"; the adapter passes a
   * real filesystem check so `uniqueFilename` can suffix `-2`/`-3` on a rare clash.
   */
  exists?: (filename: string) => boolean;
}

/**
 * Plan a silent (no-view) create: guard the directory and empty capture, merge the argument with
 * the read selection/clipboard, and compose the frontmatter file + a collision-free timestamp
 * filename. Returns a discriminated outcome; the adapter does the write and UI. Throws (via
 * buildCreateFile) on a malformed frontmatter pref so the adapter can surface it loudly.
 */
export function planSilentCreate({
  args,
  inputs,
  source,
  directory,
  template,
  frontmatter,
  tags,
  now,
  dateFormat,
  filenameDateFormat,
  mergeSeparator,
  exists = () => false,
}: SilentCreateInput): CreatePlan {
  if (!directory.trim()) return { kind: "missingDirectory" };

  const sep = separatorGlyph(mergeSeparator);
  const content = joinParts(
    [(args.text ?? "").trim(), inputs.selected, inputs.clipboard],
    sep,
  );
  const title = args.title ?? "";
  const project = args.project ?? "";
  if (isEmptyCapture({ content, title, project })) return { kind: "empty" };

  const vars = buildTemplateVars({
    content,
    extra: args.text ?? "",
    selected: inputs.selected,
    clipboard: inputs.clipboard,
    url: source.url,
    title,
    app: source.app,
    project,
    now,
    dateFormat,
    tags,
  });
  const file = buildCreateFile({
    frontmatterPref: frontmatter,
    created: formatDate(now, dateFormat),
    title,
    project,
    dateFallback: `${vars.date} ${vars.time}`,
    tags,
    sourceUrl: source.url,
    body: template(vars),
  });
  const filename = uniqueFilename(formatDate(now, filenameDateFormat), exists);
  return { kind: "write", directory, filename, file };
}

// ---------------------------------------------------------------------------
// Form (standalone rapid-note) planners. The Form is WYSIWYG and does NOT auto-merge: the block
// renders from the Content field ONLY (content === the `selected` var, so no backticking), the
// Clipboard/Title fields never bleed into an append, and `app` is "" (Raycast is frontmost). These
// mirror rapid-note.tsx's handleSubmit branches, extracted here so they are unit-testable.
// ---------------------------------------------------------------------------

export interface FormAppendInput {
  content: string;
  project: string;
  url: string;
  config: RoutedAppendConfig;
  now: Date;
  dateFormat: string;
}

/**
 * Form append outcome — simpler than the silent one: the Form has no terminal/clipboard nuance, so
 * an empty capture is a single `empty` (one "Nothing to append" Toast in the adapter).
 */
export type FormAppendPlan =
  | AppendWrite
  | { kind: "empty" }
  | { kind: "missingTarget"; format: AppendFormat };

/**
 * Plan the Form's append branch: route the Content field by shape and render from it alone. The
 * append guard is content-only (title/project are not append inputs). `empty` when Content is blank.
 */
export function planFormAppend({
  content,
  project,
  url,
  config,
  now,
  dateFormat,
}: FormAppendInput): FormAppendPlan {
  if (!content.trim()) return { kind: "empty" };

  const format = chooseAppendFormat(content);
  const target = config[format];
  if (!target.file.trim()) return { kind: "missingTarget", format };

  const vars = buildTemplateVars({
    content,
    extra: "",
    selected: content,
    clipboard: "",
    url,
    title: "",
    app: "",
    project,
    now,
    dateFormat,
  });
  const template =
    format === "note" ? TEMPLATES.appendNote : TEMPLATES.checklist;

  return {
    kind: "write",
    format,
    file: target.file,
    heading: target.heading,
    groupText: `_${vars.date}_`,
    line: template(vars),
    updated: formatDate(now, dateFormat),
  };
}

export interface FormCreateInput {
  content: string;
  title: string;
  project: string;
  url: string;
  tags: string[];
  directory: string;
  frontmatter: string;
  now: Date;
  dateFormat: string;
  filenameDateFormat: string;
  exists?: (filename: string) => boolean;
}

/**
 * Form create outcome — narrower than the silent one: the Form has NO empty-capture guard (submit
 * is an explicit user action), so `empty` is impossible here.
 */
export type FormCreatePlan = CreateWrite | { kind: "missingDirectory" };

/**
 * Plan the Form's create branch: compose a frontmatter file from the Content field + the source URL
 * reference. `missingDirectory` when the create directory is unset; throws (via buildCreateFile) on
 * a malformed frontmatter pref. Note: unlike silent create, the Form has NO empty-capture guard —
 * the submit is an explicit user action, mirrored here as-is.
 */
export function planFormCreate({
  content,
  title,
  project,
  url,
  tags,
  directory,
  frontmatter,
  now,
  dateFormat,
  filenameDateFormat,
  exists = () => false,
}: FormCreateInput): FormCreatePlan {
  if (!directory.trim()) return { kind: "missingDirectory" };

  const vars = buildTemplateVars({
    content,
    extra: "",
    selected: content,
    clipboard: "",
    url,
    title,
    app: "",
    project,
    now,
    dateFormat,
    tags,
  });
  const file = buildCreateFile({
    frontmatterPref: frontmatter,
    created: formatDate(now, dateFormat),
    title,
    project,
    dateFallback: `${vars.date} ${vars.time}`,
    tags,
    sourceUrl: url.trim(),
    body: TEMPLATES.formCreate(vars),
  });
  const filename = uniqueFilename(formatDate(now, filenameDateFormat), exists);
  return { kind: "write", directory, filename, file };
}
