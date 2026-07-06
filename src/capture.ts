import { Toast, showHUD, showToast } from "@raycast/api";
import { join } from "node:path";
import { mergeCapturedContent, separatorGlyph } from "./lib/content";
import { formatDate } from "./lib/datetime";
import { uniqueFilename } from "./lib/filename";
import { upsertUpdatedField } from "./lib/frontmatter";
import { applyAppend, buildCreateFile, isEmptyCapture } from "./lib/note";
import { parseTags } from "./lib/tags";
import { renderTemplate } from "./lib/template";
import { buildTemplateVars } from "./lib/vars";
import {
  fileExists,
  readFile,
  readSelectionOrClipboard,
  readSource,
  writeFile,
} from "./shared";

// Adapter helpers shared by the no-view (instant) commands. Not unit-tested (they import
// @raycast/api); all real logic lives in ./lib. Verify behaviour via `make dev`.

export interface SharedPrefs {
  dateFormat: string;
  filenameDateFormat: string;
  defaultTags: string;
  clipboardFallback: boolean;
  mergeSeparator: string;
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
  config: { file: string; heading: string; template: string },
  prefs: SharedPrefs,
  label: string,
): Promise<void> {
  if (!config.file.trim()) {
    await showHUD(`Rapid Notes: set the ${label} file in preferences`);
    return;
  }
  const captured = await readSelectionOrClipboard(prefs.clipboardFallback);
  const content = mergeCapturedContent(
    args.text,
    captured.text,
    separatorGlyph(prefs.mergeSeparator),
  );
  if (!content.trim()) {
    await showHUD(
      prefs.clipboardFallback
        ? "Rapid Notes: nothing selected or empty clipboard"
        : "Rapid Notes: nothing selected",
    );
    return;
  }
  try {
    const now = new Date();
    const source = await readSource();
    const line = renderTemplate(
      config.template,
      buildTemplateVars({
        content,
        url: source.url,
        title: source.title,
        app: source.app,
        project: args.project ?? "",
        now,
        dateFormat: prefs.dateFormat,
      }),
    );
    const appended = applyAppend(readFile(config.file), config.heading, line);
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
  config: { directory: string; template: string; frontmatter: string },
  prefs: SharedPrefs,
  label: string,
): Promise<void> {
  if (!config.directory.trim()) {
    await showHUD(`Rapid Notes: set the ${label} directory in preferences`);
    return;
  }
  const captured = await readSelectionOrClipboard(prefs.clipboardFallback);
  const content = mergeCapturedContent(
    args.text,
    captured.text,
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
    const vars = buildTemplateVars({
      content,
      url: source.url,
      title,
      app: source.app,
      project,
      now,
      dateFormat: prefs.dateFormat,
    });
    const file = buildCreateFile({
      frontmatterPref: config.frontmatter,
      created: formatDate(now, prefs.dateFormat),
      title,
      project,
      dateFallback: `${vars.date} ${vars.time}`,
      tags: parseTags(prefs.defaultTags ?? ""),
      sourceUrl: source.url,
      body: renderTemplate(config.template, vars),
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
