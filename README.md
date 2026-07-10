# Rapid Notes

Raycast extension for fast note capture: append selected or typed text under a heading in a Markdown file, or create a new timestamped task/note file with YAML frontmatter. Each command's output format is defined in code (`src/lib/templates.ts`), not a preference.

## Commands

Three instant (`no-view`, hotkey-friendly) commands plus one editable form:

- **Append** — add the typed text (and, opt-in, the selection and/or clipboard) under a heading,
  routed by shape: a **single line** becomes a checklist item (in the checklist file), **multi-line**
  text becomes a note block (in the note file). Both are grouped by date. Reading the selection is
  off by default (enable **Use Selection**); pass text as the argument otherwise.
- **New Task** — create a timestamped task file with YAML frontmatter.
- **New Note** — create a timestamped note file with YAML frontmatter.
- **Rapid Note** — an editable form to review the capture before appending or creating a file.

The **Append** command writes **newest-first**: entries are grouped under a per-day `## _date_` sub-heading inside the configured heading, and a new entry goes to the **top** of its day group (a new day heads the section) so the most recent capture is always visible without scrolling. With no heading configured, the day group sits at the top of the file, below any YAML frontmatter.

Each command has its own settings (target file/directory, heading/frontmatter, …); the form and the instant commands do **not** share config.

## What each command writes

Each command's output is rendered in code, so optional pieces (source link, app name, browser page) appear when present and **collapse cleanly when absent** — no stray `()`, double spaces, or dangling punctuation.

**Append (single-line capture → checklist item)** — a time-stamped checklist item, auto-grouped under a `## _date_` sub-heading created once per day inside the configured heading. Newest-first at both levels: a new day heads the list and each new item goes to the top of its day. The date lives in the group heading, so the line carries only the time; a `project` renders as an `[!!info:…]` prefix, a typed argument as a backticked span, and the source link/app inline when you capture from a browser:

```
# Draft items
## _Wed, 8 July 2026_
- [ ] **14:30**: `[!!info:Work]` `note`; Fix the login redirect [link](https://example.com/a) (Safari)
```

From a non-browser app the link drops and only ` (Terminal)` remains; with no source at all, just the timed item.

**Append (multi-line capture → note block)** — a note block under its own `## _date_` day group (same date-grouping engine as the checklist). The date lives in the group heading, so the block header carries only the time, plus an optional `[!!info:project]` marker; `App`/`Page` are bulleted metadata lines; a comment slot holds the typed argument; and the captured text is quoted verbatim in a four-backtick `md` fence:

~~~
# Draft Notes
## _Wed, 8 July 2026_
**14:30** `[!!info:Work]`
- App: Safari
- Page: [Great Article](https://example.com/a)

> [!comment]
> your typed argument (or `?` when you don't type one)

````md
the captured text
````

---
~~~

The `- App:` / `- Page:` lines, the `[!!info:…]` marker, and the quote fence each vanish when their source is empty. New blocks stack newest-first at the top of the day group.

**New Task** — the body is just the captured text; the YAML frontmatter is added automatically.

**New Note** — the capture plus a `Page: …` source line when captured from a browser.

**Rapid Note** (form) — *append* mode: the Content field is routed by line-count into a checklist item or a note block (same formats and date-grouping as the instant **Append** command), written to the form's own note/checklist targets; *create* mode: same as New Note. The app name is intentionally suppressed (an open form is itself the frontmost app), so a note block from the form has no `- App:` line — its `- Page:` line appears only when you fill the URL field.

Create commands (New Task, New Note, and the form's create mode) write YAML frontmatter — `created`, `title`, `source_url`, `tags`, plus the extra fields from the command's **Frontmatter** preference — automatically. The body function outputs only the note body.

## Changing the output format

There is no template preference. Each command's output is a small function in `src/lib/templates.ts` — `TEMPLATES.checklist`, `.appendNote`, `.task`, `.note`, `.formCreate`. To change a format, edit the function and run `make dev` to reload.

Each function receives a `vars` object (built in `src/lib/vars.ts`) — the palette to draw from:

- capture trio `content` / `selected` / `clipboard`, each also as a `_f` twin (a labeled line that self-collapses when empty — except `content_f`, a four-backtick `text` code fence) and an `_inline` twin (whitespace collapsed);
- inputs `extra` (with an `extra_code` twin wrapped in an inline-code span) and `project`;
- source `url`, `title`, `app`, `page` (adaptive `[title](url)` / `<url>` / title), `link` (fixed `[link](url)`), each with an `_f` twin;
- `tags` (bare, for YAML) / `tags_f` (`#`-prefixed);
- `date` (`EEE, d MMMM yyyy`), `time` (`HH:mm`), `datetime` (the **Date Format** preference);
- `sep` — the merge-separator glyph, for templates (like `checklist`) that recompose the capture pieces themselves.

Because the templates are code, they use plain JS — conditionals, fallbacks, self-collapsing punctuation — which is exactly why they render cleanly across the browser / non-browser / empty branches. See `src/lib/vars.ts` for the exact set of fields.

## Development

See `CLAUDE.md` for architecture and conventions. Common tasks (the Makefile wraps the npm scripts):

- `make check` — lint + test + build
- `make test` — unit tests (Vitest)
- `make dev` — load into Raycast with hot reload
