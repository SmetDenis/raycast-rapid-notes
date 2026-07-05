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
import { noteFilename } from "./lib/filename";
import { appendToEnd } from "./lib/markdown";
import { buildNewNote } from "./lib/note";
import { parseTags } from "./lib/tags";
import { renderTemplate } from "./lib/template";
import { buildTemplateVars } from "./lib/vars";
import {
  fileExists,
  readActiveTab,
  readFile,
  readSelection,
  writeFile,
} from "./shared";

interface Values {
  title: string;
  tags: string;
  content: string;
  url: string;
}

export default function NewNoteCommand() {
  const prefs = getPreferenceValues<Preferences.NewNote>();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState(prefs.defaultTags ?? "");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    void (async () => {
      setContent(await readSelection());
      setUrl((await readActiveTab()).url);
    })();
  }, []);

  async function handleSubmit(values: Values) {
    try {
      const now = new Date();
      const created = formatDate(now, prefs.dateFormat);
      const stamp = formatDate(now, prefs.filenameDateFormat);
      const filename = noteFilename(stamp);
      const noteTitle = values.title.trim() || stamp;
      const body = renderTemplate(
        prefs.newNoteBodyTemplate,
        buildTemplateVars({
          content: values.content,
          url: values.url.trim(),
          title: noteTitle,
          now,
          dateFormat: prefs.dateFormat,
        }),
      );
      const path = join(prefs.newNoteDirectory, filename);
      if (fileExists(path)) {
        // Same-minute filename collision: append this note under its own heading so the
        // existing note's content is preserved and the title is not lost.
        const entry = `\n## ${noteTitle}\n\n${body.replace(/\n+$/, "")}`;
        writeFile(path, appendToEnd(readFile(path), entry));
        await showToast({
          style: Toast.Style.Success,
          title: "Appended to existing note",
          message: filename,
        });
      } else {
        writeFile(
          path,
          buildNewNote({
            created,
            tags: parseTags(values.tags),
            title: noteTitle,
            body,
          }),
        );
        await showToast({
          style: Toast.Style.Success,
          title: "Note created",
          message: filename,
        });
      }
      await popToRoot();
      await closeMainWindow();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to create note",
        message: String(error),
      });
    }
  }

  async function pasteClipboard() {
    const clip = (await Clipboard.readText()) ?? "";
    if (clip) setContent((current) => (current ? `${current}\n${clip}` : clip));
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Note" onSubmit={handleSubmit} />
          <Action title="Paste Clipboard" onAction={pasteClipboard} />
        </ActionPanel>
      }
    >
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
      <Form.TextArea
        id="content"
        title="Content"
        value={content}
        onChange={setContent}
        autoFocus
      />
      <Form.TextField id="url" title="URL" value={url} onChange={setUrl} />
    </Form>
  );
}
