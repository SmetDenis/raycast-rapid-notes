import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentAppend } from "./capture";

export default async function AppendCommand(
  props: LaunchProps<{ arguments: Arguments.Append }>,
) {
  const prefs = getPreferenceValues<Preferences.Append>();
  await runSilentAppend(
    props.arguments,
    {
      note: { file: prefs.noteFile ?? "", heading: prefs.noteHeading },
      checklist: {
        file: prefs.checklistFile ?? "",
        heading: prefs.checklistHeading,
      },
    },
    prefs,
  );
}
