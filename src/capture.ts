import { Toast, showHUD, showToast } from "@raycast/api";
import { join } from "node:path";
import { joinParts, separatorGlyph } from "./lib/content";
import { formatDate } from "./lib/datetime";
import { uniqueFilename } from "./lib/filename";
import { upsertUpdatedField } from "./lib/frontmatter";
import {
  applyAppend,
  applyGroupedAppend,
  buildCreateFile,
  isEmptyCapture,
} from "./lib/note";
import { parseTags } from "./lib/tags";
import { type TemplateFn } from "./lib/templates";
import { buildTemplateVars } from "./lib/vars";
import {
  fileExists,
  readClipboardText,
  readFile,
  readSelection,
  readSource,
  writeFile,
} from "./shared";

// Adapter helpers shared by the no-view (instant) commands. Not unit-tested (they import
// @raycast/api); all real logic lives in ./lib. Verify behaviour via `make dev`.

/** Prefs the instant APPEND path needs. No defaultTags (append has no tag source) and no filenameDateFormat. */
export interface AppendPrefs {
  dateFormat: string;
  useClipboard: boolean;
  mergeSeparator: string;
}

/** Prefs the instant CREATE path needs: adds the filename format and the tag source. */
export interface CreatePrefs extends AppendPrefs {
  filenameDateFormat: string;
  defaultTags: string;
}

export interface CommandArgs {
  text?: string;
  project?: string;
  title?: string;
}

/**
 * Instant append (no-view): read selection/clipboard, merge the typed argument, render the
 * template and append under the heading, refreshing `updated` if the target has frontmatter.
 * Bails with a HUD message when the target file is unset or nothing was captured.
 */
export async function runSilentAppend(
  args: CommandArgs,
  config: {
    file: string;
    heading: string;
    template: TemplateFn;
    /** Append-checklist: group items under an auto-created `## _date_` sub-heading. */
    groupByDate?: boolean;
  },
  prefs: AppendPrefs,
  label: string,
): Promise<void> {
  if (!config.file.trim()) {
    await showHUD(`Rapid Notes: set the ${label} file in preferences`);
    return;
  }
  const selected = await readSelection();
  const clipboard = prefs.useClipboard ? await readClipboardText() : "";
  const sep = separatorGlyph(prefs.mergeSeparator);
  const content = joinParts(
    [(args.text ?? "").trim(), selected, clipboard],
    sep,
  );
  if (!content.trim()) {
    await showHUD(
      prefs.useClipboard
        ? "Rapid Notes: nothing selected or empty clipboard"
        : "Rapid Notes: nothing selected",
    );
    return;
  }
  try {
    const now = new Date();
    const source = await readSource();
    const vars = buildTemplateVars({
      content,
      extra: args.text ?? "",
      selected,
      clipboard,
      url: source.url,
      title: source.title,
      app: source.app,
      project: args.project ?? "",
      now,
      dateFormat: prefs.dateFormat,
      separator: sep,
    });
    const line = config.template(vars);
    const current = readFile(config.file);
    const appended = config.groupByDate
      ? applyGroupedAppend(current, config.heading, `_${vars.date}_`, line)
      : applyAppend(current, config.heading, line);
    writeFile(
      config.file,
      upsertUpdatedField(appended, formatDate(now, prefs.dateFormat)),
    );
    await showHUD("Rapid Notes: appended");
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to append",
      message: String(error),
    });
  }
}

/**
 * Instant create (no-view): read selection/clipboard, merge the typed argument, then write a
 * new frontmatter file. Aborts on an empty capture (content, title AND project all blank) so a
 * stray hotkey can't leave a junk file; surfaces a loud frontmatter-pref error via a Toast.
 */
export async function runSilentCreate(
  args: CommandArgs,
  config: {
    directory: string;
    template: TemplateFn;
    frontmatter: string;
  },
  prefs: CreatePrefs,
  label: string,
): Promise<void> {
  if (!config.directory.trim()) {
    await showHUD(`Rapid Notes: set the ${label} directory in preferences`);
    return;
  }
  const selected = await readSelection();
  const clipboard = prefs.useClipboard ? await readClipboardText() : "";
  const content = joinParts(
    [(args.text ?? "").trim(), selected, clipboard],
    separatorGlyph(prefs.mergeSeparator),
  );
  const title = args.title ?? "";
  const project = args.project ?? "";
  if (isEmptyCapture({ content, title, project })) {
    await showHUD("Rapid Notes: nothing to capture");
    return;
  }
  try {
    const now = new Date();
    const source = await readSource();
    const tags = parseTags(prefs.defaultTags ?? "");
    const vars = buildTemplateVars({
      content,
      extra: args.text ?? "",
      selected,
      clipboard,
      url: source.url,
      title,
      app: source.app,
      project,
      now,
      dateFormat: prefs.dateFormat,
      tags,
    });
    const file = buildCreateFile({
      frontmatterPref: config.frontmatter,
      created: formatDate(now, prefs.dateFormat),
      title,
      project,
      dateFallback: `${vars.date} ${vars.time}`,
      tags,
      sourceUrl: source.url,
      body: config.template(vars),
    });
    const filename = uniqueFilename(
      formatDate(now, prefs.filenameDateFormat),
      (name) => fileExists(join(config.directory, name)),
    );
    writeFile(join(config.directory, filename), file);
    await showHUD(`Rapid Notes: created ${filename}`);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to create",
      message: String(error),
    });
  }
}
