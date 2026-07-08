import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentAppend } from "./capture";
import { DEFAULT_TEMPLATES } from "./lib/templates";

export default async function AppendNoteCommand(
  props: LaunchProps<{ arguments: Arguments.AppendNote }>,
) {
  const prefs = getPreferenceValues<Preferences.AppendNote>();
  await runSilentAppend(
    props.arguments,
    {
      file: prefs.appendNoteFile ?? "",
      heading: prefs.appendNoteHeading,
      templatePref: prefs.appendNoteTemplate,
      defaultTemplate: DEFAULT_TEMPLATES.appendNote,
    },
    prefs,
    "append note",
  );
}
