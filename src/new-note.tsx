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
import { buildNewNote } from "./lib/note";
import { parseTags } from "./lib/tags";
import { renderTemplate } from "./lib/template";
import { buildTemplateVars } from "./lib/vars";
import {
  fileExists,
  readSelectionOrClipboard,
  readSource,
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
  const [app, setApp] = useState("");
  const [fromClipboard, setFromClipboard] = useState(false);

  useEffect(() => {
    void (async () => {
      const selection = await readSelectionOrClipboard(prefs.clipboardFallback);
      setContent(selection.text);
      setFromClipboard(selection.fromClipboard);
      const source = await readSource();
      setUrl(source.url);
      setApp(source.app);
      // Prefill the Title field with the browser page title (web-clipper style);
      // don't clobber anything the user already typed while this resolved.
      if (source.title) setTitle((current) => current || source.title);
    })();
  }, []);

  async function handleSubmit(values: Values) {
    try {
      const now = new Date();
      const created = formatDate(now, prefs.dateFormat);
      const stamp = formatDate(now, prefs.filenameDateFormat);
      const title = values.title.trim();
      const sourceUrl = values.url.trim();
      const body = renderTemplate(
        prefs.newNoteBodyTemplate,
        buildTemplateVars({
          content: values.content,
          url: sourceUrl,
          title,
          app,
          now,
          dateFormat: prefs.dateFormat,
        }),
      );
      // Seconds in the stamp make collisions near-impossible; on the rare clash
      // `uniqueFilename` adds a numeric suffix so every capture is its own new note.
      const filename = uniqueFilename(stamp, (name) =>
        fileExists(join(prefs.newNoteDirectory, name)),
      );
      writeFile(
        join(prefs.newNoteDirectory, filename),
        buildNewNote({
          created,
          tags: parseTags(values.tags),
          title,
          sourceUrl,
          body,
        }),
      );
      await showToast({
        style: Toast.Style.Success,
        title: "Note created",
        message: filename,
      });
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
      <Form.TextField id="url" title="URL" value={url} onChange={setUrl} />
      <Form.TextField
        id="tags"
        title="Tags"
        placeholder="comma, separated"
        value={tags}
        onChange={setTags}
      />
    </Form>
  );
}
