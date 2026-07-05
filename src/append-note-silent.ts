import { Toast, getPreferenceValues, showHUD, showToast } from "@raycast/api";
import { applyAppend } from "./lib/note";
import { renderTemplate } from "./lib/template";
import { buildTemplateVars } from "./lib/vars";
import { readActiveTab, readFile, readSelection, writeFile } from "./shared";

export default async function AppendNoteSilentCommand() {
  const prefs = getPreferenceValues<Preferences.AppendNoteSilent>();

  const selection = (await readSelection()).trim();
  if (!selection) {
    await showHUD("Quick Notes: nothing selected");
    return;
  }

  try {
    const tab = await readActiveTab();
    const line = renderTemplate(
      prefs.appendTemplate,
      buildTemplateVars({
        content: selection,
        url: tab.url,
        title: tab.title,
        now: new Date(),
        dateFormat: prefs.dateFormat,
      }),
    );
    const current = readFile(prefs.appendTargetFile);
    writeFile(
      prefs.appendTargetFile,
      applyAppend(current, prefs.appendHeading, line),
    );
    await showHUD("Quick Notes: appended");
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to append",
      message: String(error),
    });
  }
}
