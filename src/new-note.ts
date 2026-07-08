import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentCreate } from "./capture";
import { TEMPLATES } from "./lib/templates";

export default async function NewNoteCommand(
  props: LaunchProps<{ arguments: Arguments.NewNote }>,
) {
  const prefs = getPreferenceValues<Preferences.NewNote>();
  await runSilentCreate(
    props.arguments,
    {
      directory: prefs.noteDirectory ?? "",
      template: TEMPLATES.note,
      frontmatter: prefs.noteFrontmatter,
    },
    prefs,
    "note",
  );
}
