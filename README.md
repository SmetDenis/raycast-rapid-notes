# Rapid Notes

Raycast extension for fast note capture - append selected or typed text under a heading in a Markdown file, or create a new timestamped task/note file with YAML frontmatter, all driven by templates with placeholders.

## Commands

Four instant (`no-view`, hotkey-friendly) commands plus one editable form:

- **Append Checklist** - instantly append the selection or typed text as a checklist item under a heading.
- **Append Note** - instantly append it as a block under a heading.
- **New Task** - instantly create a timestamped task file with YAML frontmatter.
- **New Note** - instantly create a timestamped note file with YAML frontmatter.
- **Rapid Note** - an editable form to review the capture before appending or creating a file.

## Templates

Every command's template preference accepts the same placeholders. The preference fields are single-line, so write a newline as `\n`, a tab as `\t`, and a literal backslash as `\\` - the escapes are interpreted in the template only, never in the captured text.

### Placeholders

The capture trio (`content`, `selected`, `clipboard`) each has a raw form, a formatted `_f` twin
(a labeled line that self-collapses when empty - except `content_f`, a four-backtick code fence), and a `_oneline` twin (whitespace collapsed to single spaces).

| Placeholder                                                       | Value                                                                                                                   |
|-------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `{content}`                                                       | Primary text. Instant commands: `extra` + selection + clipboard joined by the Merge Separator. Form: the Content field. |
| `{content_f}`                                                     | `{content}` wrapped VERBATIM in a four-backtick `text` code fence (pasted code can't break out)                         |
| `{content_oneline}` **(new)**                                     | `{content}` with newlines/whitespace collapsed to single spaces                                                         |
| `{selected}` / `{selected_f}` / `{selected_oneline}` **(new)**    | Raw selection · `Selected: …` · one-line                                                                                |
| `{clipboard}` / `{clipboard_f}` / `{clipboard_oneline}` **(new)** | Clipboard (needs **Merge the clipboard** on) · `Clipboard: …` · one-line                                                |
| `{extra}` / `{extra_f}` **(new)**                                 | The typed text argument · `Extra: …`                                                                                    |
| `{project}` / `{project_f}`                                       | Project (argument or the Form's Project field) · `Project: …`                                                           |
| `{url}` / `{url_f}`                                               | Active browser-tab URL · `Url: <…>`                                                                                     |
| `{title}` / `{title_f}`                                           | Active browser-tab title · `Title: …`                                                                                   |
| `{app}` / `{app_f}`                                               | Frontmost app name · `From app: …`                                                                                      |
| `{page}` / `{page_f}`                                             | Adaptive link `[title](url)` / `<url>` / title · `Page: …`                                                              |
| `{link}` / `{link_f}` **(new)**                                   | Fixed-anchor link `[link](url)` (inline) · same on its own line                                                         |
| `{tags}` / `{tags_f}` **(changed)**                               | `tag1, tag2` (bare, for YAML) · `Tags: #tag1, #tag2`                                                                    |
| `{date}` / `{time}` / `{datetime}`                                | `EEE, d MMMM yyyy` · `HH:mm` · your **Date Format** preference                                                          |

Notes:

- `{url}` / `{title}` / `{page}` / `{link}` are filled only when you capture from a browser; `{app}` is always available.
- `{clipboard}` (and the clipboard's contribution to `{content}`) require the per-command **Merge the clipboard into the capture** preference.
- **Create** commands write YAML frontmatter (`created`, `tags`, `title`, `source_url`, plus your extra fields) automatically - put only body content in the template.

### Append examples (checklist file)

- **Checklist item** (default) - `- [ ] {content}` → `- [ ] Fix the login redirect`
- **Plain bullet** - `- {content}` → `- Fix the login redirect`
- **Dated task** - `- [ ] {content} (added {date})` → `- [ ] Fix the login redirect (added Sun, 5 July 2026)`
- **Worklog / standup line** - `- {time} - {content}` → `- 23:36 - Fix the login redirect`
- **Reading list with link** - `- [ ] {content} - {page}` → `- [ ] Fix the login redirect - [Example Page](https://example.com/a)`
- **Compact source link** - `- [ ] {content} {link}` → `- [ ] Fix the login redirect [link](https://example.com/a)`
- **Merge a copied snippet** (needs **Merge the clipboard into the capture** on) - `{content}\n{clipboard_f}` - the capture, then a self-collapsing `Clipboard: …` line.
- **Quote with source** (multi-line via `\n`) - `> {content}\n> - {page}`:

  ```
  > Fix the login redirect
  > - [Example Page](https://example.com/a)
  ```

- **Bookmark with self-collapsing metadata** - `- [ ] {content}\n{url_f}{app_f}`:

  ```
  - [ ] Fix the login redirect
  Url: <https://example.com/a>
  From app: Google Chrome
  ```

  Captured from a non-browser app, the `Url:` line simply vanishes.

- **Code snippet** - `{content_f}` - wraps the selection verbatim in a fenced `text` block; empty captures collapse to nothing.

### Create examples (body template)

- **Plain capture** (default) - `{content}`
- **Daily journal** - `# {date}\n\n{content}`:

  ```
  # Sun, 5 July 2026

  Fix the login redirect
  ```

- **Web clipping** - `# {title}\n\n{content}\n\nSource: {page}`:

  ```
  # Example Page

  Fix the login redirect

  Source: [Example Page](https://example.com/a)
  ```

  The URL is also saved to `source_url` in the frontmatter automatically.

- **Snippet with metadata footer** - `{content_f}{page_f}Captured: {datetime}` - the fenced snippet, an optional source line that collapses when there's no page, then a capture timestamp.

### Full examples (rich `_f` formatting)

Two ready-to-paste templates that stack the formatted `_f` twins: browser metadata shows up when present and collapses cleanly when it's absent, while the always-present literal parts (labels, divider, `{datetime}`) keep the layout stable.

**Append - inbox entry with a source footer**

`- [ ] {content}\n{page_f}{app_f}Added: {datetime}`

Captured from a browser, one appended entry becomes:

```
- [ ] Fix the login redirect
Page: [Example Page](https://example.com/a)
From app: Google Chrome
Added: 2026-07-05T23:36:00
```

From a non-browser app the `Page:` line disappears; `From app:` and `Added:` stay.

**Create - clipped note**

`{content_f}\n{page_f}{app_f}Captured: {datetime}`

The complete file - auto-generated frontmatter followed by the rendered body:

~~~
---
created: 2026-07-05T23:36:00
tags: [inbox]
title: Example Page
source_url: https://example.com/a
type: task
task_status: active
---
````text
Fix the login redirect
````

Page: [Example Page](https://example.com/a)
From app: Google Chrome
Captured: 2026-07-05T23:36:00
~~~

`title` and `source_url` in the frontmatter come from the title (argument or the form's Title field) and the browser URL (generated structurally), not from the body template - so the body stays free of duplicated metadata.

## Development

See `CLAUDE.md` for architecture and conventions. Common tasks (Makefile wraps the npm scripts):

- `make check` - lint + test + build
- `make test` - unit tests (Vitest)
- `make dev` - load into Raycast with hot reload
