import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentAppend } from "./capture";
import { DEFAULT_TEMPLATES } from "./lib/templates";

export default async function AppendChecklistCommand(
  props: LaunchProps<{ arguments: Arguments.AppendChecklist }>,
) {
  const prefs = getPreferenceValues<Preferences.AppendChecklist>();
  await runSilentAppend(
    props.arguments,
    {
      file: prefs.checklistFile ?? "",
      heading: prefs.checklistHeading,
      templatePref: prefs.checklistTemplate,
      defaultTemplate: DEFAULT_TEMPLATES.checklist,
    },
    prefs,
    "checklist",
  );
}
