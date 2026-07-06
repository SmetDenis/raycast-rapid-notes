import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentAppend } from "./capture";

export default async function AppendChecklistCommand(
  props: LaunchProps<{ arguments: Arguments.AppendChecklist }>,
) {
  const prefs = getPreferenceValues<Preferences.AppendChecklist>();
  await runSilentAppend(
    props.arguments,
    {
      file: prefs.checklistFile ?? "",
      heading: prefs.checklistHeading,
      template: prefs.checklistTemplate,
    },
    prefs,
    "checklist",
  );
}
