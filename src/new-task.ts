import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentCreate } from "./capture";
import { TEMPLATES } from "./lib/templates";

export default async function NewTaskCommand(
  props: LaunchProps<{ arguments: Arguments.NewTask }>,
) {
  const prefs = getPreferenceValues<Preferences.NewTask>();
  await runSilentCreate(
    props.arguments,
    {
      directory: prefs.taskDirectory ?? "",
      template: TEMPLATES.task,
      frontmatter: prefs.taskFrontmatter,
    },
    prefs,
    "task",
  );
}
