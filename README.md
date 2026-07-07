# Rapid Notes

Raycast extension for fast note capture - append selected or typed text to a Markdown file as checklist items, or create a new timestamped note with frontmatter, all driven by templates with placeholders.

## Commands

- **Append Rapid Item** - a form to edit the selected/typed text before appending.
- **Append Rapid Item (Silent)** - instantly append the current selection, no UI.
- **New Rapid Note** - create a timestamped note with `created` / `tags` / `title` frontmatter.

## Templates

Both **Append Rapid Item: Template** and **New Rapid Note: Body Template** accept the same placeholders. The preference fields are single-line, so write a newline as `\n`, a tab as `\t`, and a literal backslash as `\\` - the escapes are interpreted in the template only, never in the captured text.

### Placeholders

| Raw           | Value                                                       | Example (from a browser)                       |
|---------------|-------------------------------------------------------------|------------------------------------------------|
| `{content}`   | Captured or typed text, trimmed                             | `Fix the login redirect`                       |
| `{content_f}` | Capture wrapped in a `text` code fence                      | four backticks, so pasted code can't break out |
| `{url}`       | Active browser-tab URL                                      | `https://example.com/a`                        |
| `{url_f}`     | `Url: <…>`                                                  | `Url: <https://example.com/a>`                 |
| `{title}`     | Active browser-tab title                                    | `Example Page`                                 |
| `{title_f}`   | `Title: …`                                                  | `Title: Example Page`                          |
| `{app}`       | Frontmost app name (any app, always available)              | `Google Chrome`                                |
| `{app_f}`     | `From app: …`                                               | `From app: Google Chrome`                      |
| `{page}`      | Adaptive link: `[title](url)`, else `<url>`, else the title | `[Example Page](https://example.com/a)`        |
| `{page_f}`    | `Page: …`                                                   | `Page: [Example Page](https://example.com/a)`  |
| `{date}`      | `EEE, d MMMM yyyy`                                          | `Sun, 5 July 2026`                             |
| `{time}`      | `HH:mm`                                                     | `23:36`                                        |
| `{datetime}`  | Your **Date Format** preference                             | `2026-07-05T23:36:00`                          |

That is the complete set of variables - five raw (`{content}` `{url}` `{title}` `{app}` `{page}`), five formatted twins (`{content_f}` `{url_f}` `{title_f}` `{app_f}` `{page_f}`), and three date/time
(`{date}` `{time}` `{datetime}`).

Notes:

- `{url}` / `{title}` / `{page}` are filled only when you capture from a browser; `{app}` is the frontmost app and is always available.
- **New Rapid Note** writes its YAML frontmatter (`created`, `tags`, `title`, `source_url`,
  `type`, `task_status`) automatically - put only body content in the Body Template.

### Append examples (checklist file)

- **Checklist item** (default) - `- [ ] {content}` → `- [ ] Fix the login redirect`
- **Plain bullet** - `- {content}` → `- Fix the login redirect`
- **Dated task** - `- [ ] {content} (added {date})` → `- [ ] Fix the login redirect (added Sun, 5 July 2026)`
- **Worklog / standup line** - `- {time} - {content}` → `- 23:36 - Fix the login redirect`
- **Reading list with link** - `- [ ] {content} - {page}` → `- [ ] Fix the login redirect - [Example Page](https://example.com/a)`
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

### New Rapid Note examples (body template)

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

**New Rapid Note - clipped note**

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

`title` and `source_url` in the frontmatter come from the form's title field and the browser URL
(generated structurally), not from the body template - so the body stays free of duplicated metadata.

## Development

See `CLAUDE.md` for architecture and conventions. Common tasks (Makefile wraps the npm scripts):

- `make check` - lint + test + build
- `make test` - unit tests (Vitest)
- `make dev` - load into Raycast with hot reload
