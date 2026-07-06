import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  LaunchProps,
  Toast,
  closeMainWindow,
  getPreferenceValues,
  popToRoot,
  showToast,
} from "@raycast/api";
import { join } from "node:path";
import { useEffect, useState } from "react";
import { mergeCapturedContent, separatorGlyph } from "./lib/content";
import { formatDate } from "./lib/datetime";
import { uniqueFilename } from "./lib/filename";
import { upsertUpdatedField } from "./lib/frontmatter";
import { applyAppend, buildCreateFile } from "./lib/note";
import { parseTags } from "./lib/tags";
import { renderTemplate } from "./lib/template";
import { buildTemplateVars } from "./lib/vars";
import {
  fileExists,
  readFile,
  readSelectionOrClipboard,
  readSource,
  writeFile,
} from "./shared";

type Target = "checklist" | "append" | "task" | "note";

function isCreate(target: Target): boolean {
  return target === "task" || target === "note";
}

interface Values {
  target: Target;
  content: string;
  url: string;
  project: string;
  title?: string;
  tags?: string;
}

/**
 * Editable-capture form. A target dropdown picks one of the four operations; the fields adapt
 * (append → content/project/url, create → also title/tags). All construction is delegated to
 * ./lib (applyAppend / buildCreateFile), so this adapter only gathers input and dispatches.
 */
export default function RapidNoteCommand(
  props: LaunchProps<{ arguments: Arguments.RapidNote }>,
) {
  const prefs = getPreferenceValues<Preferences.RapidNote>();
  const [target, setTarget] = useState<Target>("checklist");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [tabTitle, setTabTitle] = useState("");
  const [app, setApp] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState(prefs.defaultTags ?? "");
  const [project, setProject] = useState(props.arguments.project ?? "");
  const [fromClipboard, setFromClipboard] = useState(false);

  useEffect(() => {
    void (async () => {
      const selection = await readSelectionOrClipboard(prefs.clipboardFallback);
      setContent(
        mergeCapturedContent(
          props.arguments.text,
          selection.text,
          separatorGlyph(prefs.mergeSeparator),
        ),
      );
      setFromClipboard(selection.fromClipboard);
      const source = await readSource();
      setUrl(source.url);
      setTabTitle(source.title);
      setApp(source.app);
      // Prefill the Title field with the browser page title (web-clipper style) without
      // clobbering anything the user already typed while this resolved.
      if (source.title) setTitle((current) => current || source.title);
    })();
  }, []);

  async function handleSubmit(values: Values) {
    try {
      const now = new Date();
      const create = isCreate(values.target);
      const vars = buildTemplateVars({
        content: values.content,
        url: values.url,
        title: create ? (values.title ?? "") : tabTitle,
        app,
        project: values.project,
        now,
        dateFormat: prefs.dateFormat,
      });

      if (create) {
        const directory =
          (values.target === "task"
            ? prefs.taskDirectory
            : prefs.noteDirectory) ?? "";
        if (!directory.trim()) {
          await showToast({
            style: Toast.Style.Failure,
            title: `Set the ${values.target} directory in preferences`,
          });
          return;
        }
        const file = buildCreateFile({
          frontmatterPref:
            values.target === "task"
              ? prefs.taskFrontmatter
              : prefs.noteFrontmatter,
          created: formatDate(now, prefs.dateFormat),
          title: values.title ?? "",
          project: values.project,
          dateFallback: `${vars.date} ${vars.time}`,
          tags: parseTags(values.tags ?? ""),
          sourceUrl: values.url.trim(),
          body: renderTemplate(
            values.target === "task" ? prefs.taskTemplate : prefs.noteTemplate,
            vars,
          ),
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
        const file =
          (values.target === "checklist"
            ? prefs.checklistFile
            : prefs.appendNoteFile) ?? "";
        if (!file.trim()) {
          await showToast({
            style: Toast.Style.Failure,
            title: `Set the ${values.target} file in preferences`,
          });
          return;
        }
        const heading =
          values.target === "checklist"
            ? prefs.checklistHeading
            : prefs.appendNoteHeading;
        const template =
          values.target === "checklist"
            ? prefs.checklistTemplate
            : prefs.appendNoteTemplate;
        const appended = applyAppend(
          readFile(file),
          heading,
          renderTemplate(template, vars),
        );
        writeFile(
          file,
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

  async function pasteClipboard() {
    const clip = (await Clipboard.readText()) ?? "";
    if (clip) {
      setContent((current) => (current ? `${current}\n${clip}` : clip));
      if (fromClipboard) setFromClipboard(false);
    }
  }

  const create = isCreate(target);

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
          <Action title="Paste Clipboard" onAction={pasteClipboard} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="target"
        title="Target"
        value={target}
        onChange={(v) => setTarget(v as Target)}
      >
        <Form.Dropdown.Item value="checklist" title="Append Checklist" />
        <Form.Dropdown.Item value="append" title="Append Note" />
        <Form.Dropdown.Item value="task" title="New Task" />
        <Form.Dropdown.Item value="note" title="New Note" />
      </Form.Dropdown>
      {fromClipboard && (
        <Form.Description text="Text was taken from the clipboard — nothing was selected." />
      )}
      <Form.TextArea
        id="content"
        title="Content"
        value={content}
        onChange={(value) => {
          setContent(value);
          if (fromClipboard) setFromClipboard(false);
        }}
        autoFocus
      />
      {create && (
        <Form.TextField
          id="title"
          title="Title"
          value={title}
          onChange={setTitle}
        />
      )}
      {create && (
        <Form.TextField
          id="tags"
          title="Tags"
          placeholder="comma, separated"
          value={tags}
          onChange={setTags}
        />
      )}
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
