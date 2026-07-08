# Rapid Notes

Raycast extension for fast note capture: append selected or typed text under a heading in a Markdown file, or create a new timestamped task/note file with YAML frontmatter. Each command's output format is defined in code (`src/lib/templates.ts`), not a preference.

## Commands

Four instant (`no-view`, hotkey-friendly) commands plus one editable form:

- **Append Checklist** — append the selection or typed text as a checklist item under a heading.
- **Append Note** — append it as a block under a heading.
- **New Task** — create a timestamped task file with YAML frontmatter.
- **New Note** — create a timestamped note file with YAML frontmatter.
- **Rapid Note** — an editable form to review the capture before appending or creating a file.

Each command has its own settings (target file/directory, heading/frontmatter, …); the form and the instant commands do **not** share config.

## What each command writes

Each command's output is rendered in code, so optional pieces (source link, app name, browser page) appear when present and **collapse cleanly when absent** — no stray `()`, double spaces, or dangling punctuation.

**Append Checklist** — a dated checklist line; the source link and app are inlined when you capture from a browser:

```
- [ ] **Wed, 8 July 2026 14:30** Fix the login redirect [link](https://example.com/a) (Safari)
```

From a non-browser app the link drops and only ` (Terminal)` remains; with no source at all, just the dated item.

**Append Note** — a dated block with best-effort metadata, a comment slot, and the selection quoted verbatim:

~~~
- **Wed, 8 July 2026 14:30**
From app: Safari
Page: [Great Article](https://example.com/a)

> [!comment]
> your typed argument (or `?` when you don't type one)

````text
the selected text
````

---
~~~

The `From app:` / `Page:` lines and the quote fence each vanish when their source is empty.

**New Task** — the body is just the captured text; the YAML frontmatter is added automatically.

**New Note** — the capture plus a `Page: …` source line when captured from a browser.

**Rapid Note** (form) — *append* mode: the capture with a dated footer `_Wed, 8 July 2026 14:30_`; *create* mode: same as New Note. The app name is intentionally left out of the form footer (an open form is itself the frontmost app).

Create commands (New Task, New Note, and the form's create mode) write YAML frontmatter — `created`, `title`, `source_url`, `tags`, plus the extra fields from the command's **Frontmatter** preference — automatically. The body function outputs only the note body.

## Changing the output format

There is no template preference. Each command's output is a small function in `src/lib/templates.ts` — `TEMPLATES.checklist`, `.appendNote`, `.task`, `.note`, `.formAppend`, `.formCreate`. To change a format, edit the function and run `make dev` to reload.

Each function receives a `vars` object (built in `src/lib/vars.ts`) — the palette to draw from:

- capture trio `content` / `selected` / `clipboard`, each also as a `_f` twin (a labeled line that self-collapses when empty — except `content_f`, a four-backtick `text` code fence) and an `_inline` twin (whitespace collapsed);
- inputs `extra`, `project`;
- source `url`, `title`, `app`, `page` (adaptive `[title](url)` / `<url>` / title), `link` (fixed `[link](url)`), each with an `_f` twin;
- `tags` (bare, for YAML) / `tags_f` (`#`-prefixed);
- `date` (`EEE, d MMMM yyyy`), `time` (`HH:mm`), `datetime` (the **Date Format** preference).

Because the templates are code, they use plain JS — conditionals, fallbacks, self-collapsing punctuation — which is exactly why they render cleanly across the browser / non-browser / empty branches. See `src/lib/vars.ts` for the exact set of fields.

## Development

See `CLAUDE.md` for architecture and conventions. Common tasks (the Makefile wraps the npm scripts):

- `make check` — lint + test + build
- `make test` — unit tests (Vitest)
- `make dev` — load into Raycast with hot reload
