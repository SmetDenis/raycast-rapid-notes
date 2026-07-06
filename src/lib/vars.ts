import { formatDate } from "./datetime";
import type { TemplateVars } from "./template";

export interface VarsInput {
  /** Raw captured text (untrimmed): `{content}` is trimmed here, `{content_f}` stays verbatim. */
  content: string;
  url: string;
  title: string;
  app: string;
  project: string;
  now: Date;
  dateFormat: string;
}

/**
 * Build the placeholder variables for a template render. Each captured field has a raw
 * form (`{content}`/`{url}`/`{title}`/`{app}`/`{project}`/`{page}` — trimmed, no label, ""
 * when empty) and a formatted form (`{content_f}`/`{url_f}`/`{title_f}`/`{app_f}`/`{project_f}`/`{page_f}` — a labeled
 * line that ends in a newline and vanishes entirely when its value is empty). `{page}` is a
 * Markdown link that adapts to what's present: `[title](url)`, else `<url>`, else the title.
 */
export function buildTemplateVars({
  content,
  url,
  title,
  app,
  project,
  now,
  dateFormat,
}: VarsInput): TemplateVars {
  const contentT = content.trim();
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

  return {
    content: contentT,
    app: appT,
    url: urlT,
    title: titleT,
    project: projectT,
    page,
    // {content_f} wraps the RAW (untrimmed) content in a four-backtick fence so pasted
    // triple-backtick blocks can't break out; empty (whitespace-only) content collapses to "".
    content_f: contentT ? `\`\`\`\`text\n${content}\n\`\`\`\`\n` : "",
    app_f: appT ? `From app: ${appT}\n` : "",
    url_f: urlT ? `Url: <${urlT}>\n` : "",
    title_f: titleT ? `Title: ${titleT}\n` : "",
    project_f: projectT ? `Project: ${projectT}\n` : "",
    page_f: page ? `Page: ${page}\n` : "",
    date: formatDate(now, "EEE, d MMMM yyyy"),
    time: formatDate(now, "HH:mm"),
    datetime: formatDate(now, dateFormat),
  };
}
