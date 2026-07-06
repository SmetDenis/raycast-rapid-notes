import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentCreate } from "./capture";

export default async function NewNoteCommand(
  props: LaunchProps<{ arguments: Arguments.NewNote }>,
) {
  const prefs = getPreferenceValues<Preferences.NewNote>();
  await runSilentCreate(
    props.arguments,
    {
      directory: prefs.noteDirectory ?? "",
      template: prefs.noteTemplate,
      frontmatter: prefs.noteFrontmatter,
    },
    prefs,
    "note",
  );
}
