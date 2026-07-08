import { formatDate } from "./datetime";
import type { TemplateVars } from "./template";

export interface VarsInput {
  /** Caller-composed primary content (instant = joinParts of the pieces; Form = the Content field). */
  content: string;
  /** Raw pieces — optional so callers migrate incrementally; each defaults to "". */
  extra?: string;
  selected?: string;
  clipboard?: string;
  url: string;
  title: string;
  app: string;
  project: string;
  now: Date;
  dateFormat: string;
  /** Already-parsed, cleaned tag list (via lib/tags.parseTags); optional — "" when absent. */
  tags?: string[];
}

/** Collapse every whitespace run to a single space and trim. */
function oneline(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Build the placeholder variables for a template render. The capture trio (`content`, `selected`,
 * `clipboard`) each has a raw form (trimmed, "" when empty), a `_f` form (a labeled line ending in
 * a newline — except `content_f`, a four-backtick `text` fence that wraps content VERBATIM so
 * pasted triple-backtick blocks can't break out), and a `_inline` form (whitespace collapsed).
 * `{extra}`/`{project}` are inputs; `{page}` is an adaptive link and `{link}` a fixed-anchor one;
 * `{tags}` is bare (for YAML) while `{tags_f}` prefixes each tag with `#`.
 */
export function buildTemplateVars({
  content,
  extra = "",
  selected = "",
  clipboard = "",
  url,
  title,
  app,
  project,
  now,
  dateFormat,
  tags = [],
}: VarsInput): TemplateVars {
  const contentT = content.trim();
  const extraT = extra.trim();
  const selectedT = selected.trim();
  const clipboardT = clipboard.trim();
  const urlT = url.trim();
  const titleT = title.trim();
  const appT = app.trim();
  const projectT = project.trim();

  const page =
    urlT && titleT
      ? `[${titleT}](${urlT})`
      : urlT
        ? `<${urlT}>`
        : titleT
          ? titleT
          : "";
  const link = urlT ? `[link](${urlT})` : "";

  return {
    // capture trio — raw
    content: contentT,
    selected: selectedT,
    clipboard: clipboardT,
    // capture trio — inline
    content_inline: oneline(content),
    selected_inline: oneline(selected),
    clipboard_inline: oneline(clipboard),
    // capture trio — formatted (content_f is a fence, not a label)
    content_f: contentT ? `\`\`\`\`text\n${content}\n\`\`\`\`\n` : "",
    selected_f: selectedT ? `Selected: ${selectedT}\n` : "",
    clipboard_f: clipboardT ? `Clipboard: ${clipboardT}\n` : "",
    // inputs
    extra: extraT,
    extra_f: extraT ? `Extra: ${extraT}\n` : "",
    project: projectT,
    project_f: projectT ? `Project: ${projectT}\n` : "",
    // source
    url: urlT,
    url_f: urlT ? `Url: <${urlT}>\n` : "",
    title: titleT,
    title_f: titleT ? `Title: ${titleT}\n` : "",
    app: appT,
    app_f: appT ? `From app: ${appT}\n` : "",
    page,
    page_f: page ? `Page: ${page}\n` : "",
    link,
    link_f: link ? `${link}\n` : "",
    // tags — {tags} bare (YAML), {tags_f} #-prefixed
    tags: tags.join(", "),
    tags_f: tags.length ? `Tags: ${tags.map((t) => `#${t}`).join(", ")}\n` : "",
    // date/time
    date: formatDate(now, "EEE, d MMMM yyyy"),
    time: formatDate(now, "HH:mm"),
    datetime: formatDate(now, dateFormat),
  };
}
