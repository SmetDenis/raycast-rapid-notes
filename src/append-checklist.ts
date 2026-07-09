import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentAppend } from "./capture";
import { TEMPLATES } from "./lib/templates";

export default async function AppendChecklistCommand(
  props: LaunchProps<{ arguments: Arguments.AppendChecklist }>,
) {
  const prefs = getPreferenceValues<Preferences.AppendChecklist>();
  await runSilentAppend(
    props.arguments,
    {
      file: prefs.checklistFile ?? "",
      heading: prefs.checklistHeading,
      template: TEMPLATES.checklist,
      groupByDate: true,
    },
    prefs,
    "checklist",
  );
}
