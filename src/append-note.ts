import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentAppend } from "./capture";

export default async function AppendNoteCommand(
  props: LaunchProps<{ arguments: Arguments.AppendNote }>,
) {
  const prefs = getPreferenceValues<Preferences.AppendNote>();
  await runSilentAppend(
    props.arguments,
    {
      file: prefs.appendNoteFile ?? "",
      heading: prefs.appendNoteHeading,
      template: prefs.appendNoteTemplate,
    },
    prefs,
    "append note",
  );
}
