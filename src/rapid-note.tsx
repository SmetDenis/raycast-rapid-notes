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
import { formatDate } from "./lib/datetime";
import { uniqueFilename } from "./lib/filename";
import { upsertUpdatedField } from "./lib/frontmatter";
import { applyAppend, buildCreateFile } from "./lib/note";
import { parseTags } from "./lib/tags";
import { TEMPLATES } from "./lib/templates";
import { buildTemplateVars } from "./lib/vars";
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
 * Standalone editable-capture form with its OWN preferences (independent of the four instant
 * commands). A mode toggle chooses Append (write under a heading in the configured file) or
 * Create (write a new frontmatter file in the configured directory). The Content field is
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
  const [tabTitle, setTabTitle] = useState("");
  const [app, setApp] = useState("");
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
      setTabTitle(source.title);
      setApp(source.app);
      // Prefill Title with the browser page title without clobbering anything already typed.
      if (source.title) setTitle((current) => current || source.title);
    })();
  }, []);

  async function handleSubmit(values: Values) {
    try {
      const now = new Date();
      const create = values.mode === "create";
      const parsedTags = parseTags(values.tags ?? "");
      const vars = buildTemplateVars({
        content: values.content,
        extra: "",
        selected: values.content,
        clipboard: values.clipboard,
        url: values.url,
        title: create ? (values.title ?? "") : values.title || tabTitle,
        app,
        project: values.project,
        now,
        dateFormat: prefs.dateFormat,
        tags: parsedTags,
      });

      if (create) {
        const directory = prefs.createDirectory ?? "";
        if (!directory.trim()) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Set the create directory in preferences",
          });
          return;
        }
        const file = buildCreateFile({
          frontmatterPref: prefs.createFrontmatter,
          created: formatDate(now, prefs.dateFormat),
          title: values.title ?? "",
          project: values.project,
          dateFallback: `${vars.date} ${vars.time}`,
          tags: parsedTags,
          sourceUrl: values.url.trim(),
          body: TEMPLATES.formCreate(vars),
        });
        const filename = uniqueFilename(
          formatDate(now, prefs.filenameDateFormat),
          (name) => fileExists(join(directory, name)),
        );
        writeFile(join(directory, filename), file);
        await showToast({
          style: Toast.Style.Success,
          title: "Note created",
          message: filename,
        });
      } else {
        const target = prefs.appendFile ?? "";
        if (!target.trim()) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Set the append file in preferences",
          });
          return;
        }
        const appended = applyAppend(
          readFile(target),
          prefs.appendHeading,
          TEMPLATES.formAppend(vars),
        );
        writeFile(
          target,
          upsertUpdatedField(appended, formatDate(now, prefs.dateFormat)),
        );
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
