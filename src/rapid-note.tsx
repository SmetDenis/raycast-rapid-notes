import {
  Action,
  ActionPanel,
  Form,
  type LaunchProps,
  Toast,
  closeMainWindow,
  getPreferenceValues,
  popToRoot,
  showToast,
} from "@raycast/api";
import { join } from "node:path";
import { useEffect, useState } from "react";
import { upsertUpdatedField } from "./lib/frontmatter";
import { planFormAppend, planFormCreate, renderAppendedFile } from "./lib/plan";
import { parseTags } from "./lib/tags";
import {
  fileExists,
  readClipboardText,
  readFile,
  readSelection,
  readSource,
  writeFile,
} from "./shared";

type Mode = "append" | "create";

interface Values {
  mode: Mode;
  content: string;
  clipboard: string;
  title: string;
  tags: string;
  project: string;
  url: string;
}

/**
 * Standalone editable-capture form with its OWN preferences (independent of the three instant
 * commands). A mode toggle chooses Append (route the Content field by line-count to the note or
 * checklist target, date-grouped) or Create (write a new frontmatter file in the configured
 * directory). The Content field is
 * prefilled from the selection; the Clipboard field (when `useClipboard` is on) from the
 * clipboard — both editable. `{content}` is the Content field verbatim (WYSIWYG); the 3-way
 * auto-merge is an instant-command affordance. All construction is delegated to ./lib.
 */
export default function RapidNoteCommand(
  props: LaunchProps<{ draftValues: Values }>,
) {
  const prefs = getPreferenceValues<Preferences.RapidNote>();
  const draft = props.draftValues;
  // A draft exists only after the form was closed WITHOUT submitting (submit drops it), so it is
  // by definition unfinished work: restore it verbatim and skip the fresh capture below so the
  // async effect can't clobber it with a new (possibly empty) selection.
  const hasDraft = draft !== undefined;
  const [mode, setMode] = useState<Mode>(draft?.mode ?? "append");
  const [content, setContent] = useState(draft?.content ?? "");
  const [clipboard, setClipboard] = useState(draft?.clipboard ?? "");
  const [url, setUrl] = useState(draft?.url ?? "");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [tags, setTags] = useState(draft?.tags ?? prefs.defaultTags ?? "");
  const [project, setProject] = useState(draft?.project ?? "");

  useEffect(() => {
    if (hasDraft) return;
    void (async () => {
      setContent(await readSelection());
      if (prefs.useClipboard) setClipboard(await readClipboardText());
      const source = await readSource();
      setUrl(source.url);
      // Prefill Title with the browser page title without clobbering anything already typed.
      if (source.title) setTitle((current) => current || source.title);
    })();
  }, []);

  async function handleSubmit(values: Values) {
    try {
      const now = new Date();
      const parsedTags = parseTags(values.tags ?? "");

      if (values.mode === "create") {
        const plan = planFormCreate({
          content: values.content,
          title: values.title ?? "",
          project: values.project,
          url: values.url,
          tags: parsedTags,
          directory: prefs.createDirectory ?? "",
          frontmatter: prefs.createFrontmatter,
          now,
          dateFormat: prefs.dateFormat,
          filenameDateFormat: prefs.filenameDateFormat,
          exists: (name) => fileExists(join(prefs.createDirectory ?? "", name)),
        });
        if (plan.kind === "missingDirectory") {
          await showToast({
            style: Toast.Style.Failure,
            title: "Set the create directory in preferences",
          });
          return;
        }
        writeFile(join(plan.directory, plan.filename), plan.file);
        await showToast({
          style: Toast.Style.Success,
          title: "Note created",
          message: plan.filename,
        });
      } else {
        // Render from the Content field ONLY (planFormAppend): routing input equals render input,
        // and the Form's Clipboard/Title fields never bleed into the block.
        const plan = planFormAppend({
          content: values.content,
          project: values.project,
          url: values.url,
          config: {
            note: {
              file: prefs.appendNoteFile ?? "",
              heading: prefs.appendNoteHeading,
            },
            checklist: {
              file: prefs.appendChecklistFile ?? "",
              heading: prefs.appendChecklistHeading,
            },
          },
          now,
          dateFormat: prefs.dateFormat,
        });
        if (plan.kind === "empty") {
          await showToast({
            style: Toast.Style.Failure,
            title: "Nothing to append",
          });
          return;
        }
        if (plan.kind === "missingTarget") {
          await showToast({
            style: Toast.Style.Failure,
            title: `Set the append ${plan.format} file in preferences`,
          });
          return;
        }
        const appended = renderAppendedFile(readFile(plan.file), plan);
        writeFile(plan.file, upsertUpdatedField(appended, plan.updated));
        await showToast({ style: Toast.Style.Success, title: "Appended" });
      }
      await popToRoot();
      await closeMainWindow();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save",
        message: String(error),
      });
    }
  }

  return (
    <Form
      enableDrafts
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="mode"
        title="Mode"
        value={mode}
        onChange={(v) => setMode(v as Mode)}
      >
        <Form.Dropdown.Item value="append" title="Append" />
        <Form.Dropdown.Item value="create" title="Create File" />
      </Form.Dropdown>
      <Form.TextArea
        id="content"
        title="Content"
        value={content}
        onChange={setContent}
        autoFocus
      />
      <Form.TextArea
        id="clipboard"
        title="Clipboard"
        value={clipboard}
        onChange={setClipboard}
      />
      <Form.TextField
        id="title"
        title="Title"
        value={title}
        onChange={setTitle}
      />
      <Form.TextField
        id="tags"
        title="Tags"
        placeholder="comma, separated"
        value={tags}
        onChange={setTags}
      />
      <Form.TextField
        id="project"
        title="Project"
        value={project}
        onChange={setProject}
      />
      <Form.TextField id="url" title="URL" value={url} onChange={setUrl} />
    </Form>
  );
}
