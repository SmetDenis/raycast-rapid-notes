import {
  LaunchProps,
  Toast,
  getPreferenceValues,
  showHUD,
  showToast,
} from "@raycast/api";
import { mergeCapturedContent, separatorGlyph } from "./lib/content";
import { formatDate } from "./lib/datetime";
import { upsertUpdatedField } from "./lib/frontmatter";
import { applyAppend } from "./lib/note";
import { renderTemplate } from "./lib/template";
import { buildTemplateVars } from "./lib/vars";
import {
  readFile,
  readSelectionOrClipboard,
  readSource,
  writeFile,
} from "./shared";

export default async function AppendNoteSilentCommand(
  props: LaunchProps<{ arguments: Arguments.AppendNoteSilent }>,
) {
  const prefs = getPreferenceValues<Preferences.AppendNoteSilent>();

  const captured = await readSelectionOrClipboard(prefs.clipboardFallback);
  const content = mergeCapturedContent(
    props.arguments.text,
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
      prefs.appendTemplate,
      buildTemplateVars({
        content,
        url: source.url,
        title: source.title,
        app: source.app,
        now,
        dateFormat: prefs.dateFormat,
      }),
    );
    const current = readFile(prefs.appendTargetFile);
    const appended = applyAppend(current, prefs.appendHeading, line);
    // Refresh `updated` if the target already has frontmatter (no-op otherwise).
    writeFile(
      prefs.appendTargetFile,
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
