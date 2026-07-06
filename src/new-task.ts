import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentCreate } from "./capture";

export default async function NewTaskCommand(
  props: LaunchProps<{ arguments: Arguments.NewTask }>,
) {
  const prefs = getPreferenceValues<Preferences.NewTask>();
  await runSilentCreate(
    props.arguments,
    {
      directory: prefs.taskDirectory ?? "",
      template: prefs.taskTemplate,
      frontmatter: prefs.taskFrontmatter,
    },
    prefs,
    "task",
  );
}
