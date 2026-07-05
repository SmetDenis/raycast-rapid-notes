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
import { applyAppend } from "./lib/note";
import { renderTemplate } from "./lib/template";
import { buildTemplateVars } from "./lib/vars";
import { readActiveTab, readFile, readSelection, writeFile } from "./shared";

interface Values {
  content: string;
  url: string;
}

export default function AppendNoteCommand() {
  const prefs = getPreferenceValues<Preferences.AppendNote>();
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [tabTitle, setTabTitle] = useState("");
  const [contentError, setContentError] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      setContent(await readSelection());
      const tab = await readActiveTab();
      setUrl(tab.url);
      setTabTitle(tab.title);
    })();
  }, []);

  async function handleSubmit(values: Values) {
    if (!values.content.trim()) {
      setContentError("Text is required");
      return;
    }
    try {
      const line = renderTemplate(
        prefs.appendTemplate,
        buildTemplateVars({
          content: values.content.trim(),
          url: values.url.trim(),
          title: tabTitle,
          now: new Date(),
          dateFormat: prefs.dateFormat,
        }),
      );
      const current = readFile(prefs.appendTargetFile);
      writeFile(
        prefs.appendTargetFile,
        applyAppend(current, prefs.appendHeading, line),
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
      <Form.TextArea
        id="content"
        title="Text"
        placeholder="What do you want to capture?"
        value={content}
        error={contentError}
        onChange={(value) => {
          setContent(value);
          if (value.trim()) setContentError(undefined);
        }}
        autoFocus
      />
      <Form.TextField id="url" title="URL" value={url} onChange={setUrl} />
    </Form>
  );
}
