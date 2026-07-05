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
import { useEffect, useState } from "react";
import { formatDate } from "./lib/datetime";
import { upsertUpdatedField } from "./lib/frontmatter";
import { applyAppend } from "./lib/note";
import { renderTemplate } from "./lib/template";
import { buildTemplateVars } from "./lib/vars";
import {
  readFile,
  readSelectionOrClipboard,
  readSource,
  writeFile,
} from "./shared";

interface Values {
  content: string;
  url: string;
}

export default function AppendNoteCommand() {
  const prefs = getPreferenceValues<Preferences.AppendNote>();
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [tabTitle, setTabTitle] = useState("");
  const [app, setApp] = useState("");
  const [fromClipboard, setFromClipboard] = useState(false);
  const [contentError, setContentError] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const selection = await readSelectionOrClipboard(prefs.clipboardFallback);
      setContent(selection.text);
      setFromClipboard(selection.fromClipboard);
      const source = await readSource();
      setUrl(source.url);
      setTabTitle(source.title);
      setApp(source.app);
    })();
  }, []);

  async function handleSubmit(values: Values) {
    if (!values.content.trim()) {
      setContentError("Text is required");
      return;
    }
    try {
      const now = new Date();
      const line = renderTemplate(
        prefs.appendTemplate,
        buildTemplateVars({
          content: values.content,
          url: values.url,
          title: tabTitle,
          app,
          now,
          dateFormat: prefs.dateFormat,
        }),
      );
      const current = readFile(prefs.appendTargetFile);
      const appended = applyAppend(current, prefs.appendHeading, line);
      // Refresh `updated` if the target already has frontmatter (no-op otherwise).
      writeFile(
        prefs.appendTargetFile,
        upsertUpdatedField(appended, formatDate(now, prefs.dateFormat)),
      );
      await showToast({ style: Toast.Style.Success, title: "Appended" });
      await popToRoot();
      await closeMainWindow();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to append",
        message: String(error),
      });
    }
  }

  async function pasteClipboard() {
    const clip = (await Clipboard.readText()) ?? "";
    if (clip) {
      setContent((current) => (current ? `${current}\n${clip}` : clip));
      setContentError(undefined);
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Append" onSubmit={handleSubmit} />
          <Action title="Paste Clipboard" onAction={pasteClipboard} />
        </ActionPanel>
      }
    >
      {fromClipboard && (
        <Form.Description text="Text was taken from the clipboard — nothing was selected." />
      )}
      <Form.TextArea
        id="content"
        title="Text"
        placeholder="What do you want to capture?"
        value={content}
        error={contentError}
        onChange={(value) => {
          setContent(value);
          if (fromClipboard) setFromClipboard(false);
          if (value.trim()) setContentError(undefined);
        }}
        autoFocus
      />
      <Form.TextField id="url" title="URL" value={url} onChange={setUrl} />
    </Form>
  );
}
