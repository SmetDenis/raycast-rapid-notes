import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
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
import { renderTemplate } from "./lib/template";
import { buildTemplateVars } from "./lib/vars";
import {
  fileExists,
  readFile,
  readSelectionOrClipboard,
  readSource,
  writeFile,
} from "./shared";

type Mode = "append" | "create";

interface Values {
  mode: Mode;
  content: string;
  title: string;
  tags: string;
  project: string;
  url: string;
}

/**
 * Standalone editable-capture form with its OWN preferences (independent of the four instant
 * commands). A mode toggle chooses Append (write under a heading in the configured file) or
 * Create (write a new frontmatter file in the configured directory). Fields are prefilled from
 * the selection/clipboard and the frontmost app/browser. All construction is delegated to ./lib.
 */
export default function RapidNoteCommand() {
  const prefs = getPreferenceValues<Preferences.RapidNote>();
  const [mode, setMode] = useState<Mode>("append");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [tabTitle, setTabTitle] = useState("");
  const [app, setApp] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState(prefs.defaultTags ?? "");
  const [project, setProject] = useState("");
  const [fromClipboard, setFromClipboard] = useState(false);

  useEffect(() => {
    void (async () => {
      const selection = await readSelectionOrClipboard(prefs.clipboardFallback);
      setContent(selection.text);
      setFromClipboard(selection.fromClipboard);
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
          body: renderTemplate(prefs.createTemplate, vars),
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
          renderTemplate(prefs.appendTemplate, vars),
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

  async function pasteClipboard() {
    const clip = (await Clipboard.readText()) ?? "";
    if (clip) {
      setContent((current) => (current ? `${current}\n${clip}` : clip));
      if (fromClipboard) setFromClipboard(false);
    }
  }

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
        id="mode"
        title="Mode"
        value={mode}
        onChange={(v) => setMode(v as Mode)}
      >
        <Form.Dropdown.Item value="append" title="Append" />
        <Form.Dropdown.Item value="create" title="Create File" />
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
