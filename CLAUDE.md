# quick-notes — Claude Code instructions

Raycast extension (TypeScript/React) for fast note capture: append selected or typed text to a
Markdown file (as checklist/todo lines) or create a new timestamped note, formatted via a
user-configured template with placeholders. Local/personal for now; may be published to the
Raycast Store later.

## Critical

- Keep ALL business logic in `src/lib/` free of any `@raycast/api` import. Command files are thin
  adapters that call `lib`. Reason: `@raycast/api` only runs inside Raycast, so anything importing
  it is not unit-testable — `lib` is where logic and tests live.
- This tool is deliberately minimal (quick checklist/todo capture + one "new note"). Push back on
  feature creep and over-engineering before adding any command, option, or dependency.
- Do not add Store-only polish (screenshots, marketing `README.md`, `CHANGELOG.md`, `keywords`,
  `contributors`) while the extension is local-only — but keep the required manifest fields (see
  Architecture). Add polish only when we decide to publish.
- Minimal runtime dependencies: `@raycast/api` (+ `@raycast/utils` if needed) and `date-fns`
  (used for `format()` — a user-configurable date format justifies it; a hand-rolled format-string
  parser would be more code and more bugs). Render placeholders with our own code. Add no other
  runtime dependency without a comparable justification.

## Commands

Run dev operations through the Makefile (thin façade). Each target just delegates to the npm
script — `package.json` scripts stay the canonical definitions because `ray`/Raycast and the Store
publish flow depend on them; do not reimplement logic in the Makefile or the two will drift.

- `make dev` — live reload in Raycast (→ `ray develop`); also imports the extension (local-only
  distribution path, no Store publish needed).
- `make build` — compile check (→ `ray build`).
- `make lint` / `make fix` — lint / autofix (→ `ray lint` / `ray lint --fix`).
- `make test` — unit tests (→ `vitest run`); `make test-watch` for watch mode.
- `make check` — lint + test + build (the pre-finish gate).
- `make install` — install dependencies. Package manager underneath: npm (Raycast default).

## Architecture

- Command entry points (thin adapters, one file each):
  - `src/append-note.tsx` — `view` mode, Form (edit before save).
  - `src/append-note-silent.ts` — `no-view` mode, instant save + `showHUD`.
  - `src/new-note.tsx` — `view` mode, Form.
- `src/lib/` — pure core, no `@raycast/api`: template/placeholder rendering, timestamp filename
  generation, Markdown H1-heading insertion, YAML frontmatter generation (escaping-safe),
  checklist/list-item formatting, file read/append.
- Tests colocated as `src/lib/*.test.ts`.
- `assets/` — command icons (512×512 PNG; provide an `@dark` variant).
- The manifest is `package.json` (Raycast superset): it defines commands, their `mode`, and
  extension-level `preferences`, and is the source of truth for command names and preference keys.
  Required fields (needed for `ray build`/`ray lint`, not just Store): `name`, `title`,
  `description`, `icon`, `author`, `platforms`, `categories`, `commands`; `license` MIT
  recommended. Preference types include `file` and `directory` — use them for the append target
  file and the new-note directory. Command code reads prefs via the generated
  `Preferences.<Command>` types (in git-ignored `raycast-env.d.ts`, produced by `ray build`/`dev`).

## Preferences (extension-level, shared)

- Extension-level so the Form and Silent append commands read identical config: append target
  file, append H1 heading (empty ⇒ append to end of file), append template, new-note directory,
  new-note body template.
- Template placeholders: `{content}`, `{url}`, `{title}`, `{date}`, `{time}`, `{datetime}`.
  Defaults: append `- [ ] {content}`; new-note body `{content}` (the title lives in frontmatter,
  not a body heading). No `{clipboard}` placeholder — the Form's "paste clipboard" action inserts
  clipboard text into `{content}`, keeping clipboard opt-in and Form/Silent output identical.
- New Note only: writes YAML frontmatter — a fixed minimal set generated structurally in `lib`
  (NOT from the template) — then the body template. Fields: `created` (ISO local datetime, minute
  precision), `tags` (YAML list, empty ⇒ `[]`), `title`. Tags come from a comma-separated Form
  field; `title` from the Form title field (empty ⇒ the timestamp).
- Date format: a `textfield` preference holding a date-fns format string; default
  `yyyy-MM-dd'T'HH:mm:ss`; applies to `created` and `{datetime}`. Raycast preferences have no
  textarea type — comma-separated values live in single-line `textfield`s.
- Default tags: a comma-separated `textfield` preference. The New Note form prefills its tags
  field from it; the user edits per note (prefill/replace, not merge).

## Gotchas

- `getSelectedText()` REJECTS (throws) when nothing is selected — it never returns an empty string.
  Wrap in try/catch and treat rejection as empty. It also needs macOS Accessibility permission and
  can fail per-app; that is why the Form keeps an editable TextArea prefilled with the selection
  plus a manual "paste clipboard" action.
- Silent (`no-view`) command: never render UI. Use the selection only — do NOT auto-read the
  clipboard — give feedback via `showHUD`, and on empty selection show a HUD error and exit.
  Clipboard stays opt-in and lives only in the Form.
- Browser URL is best-effort: `BrowserExtension.getTabs()` throws if the Raycast Browser Extension
  is not installed — wrap in try/catch and leave the URL field empty on failure. The active tab is
  the one with `active === true`.
- Form `defaultValue` is applied once per component lifecycle — prefill the selection via
  `defaultValue`, not `value`.
- Markdown heading insertion is the most bug-prone piece: explicitly define and test the
  heading-missing, multiple-matching-headings, and empty-file cases.
- YAML frontmatter (New Note) is the other bug-prone piece: `title` can contain `:`, `#`, or
  quotes and tags can contain spaces — quote/escape structurally and test special-char titles,
  empty tags, and multi-tag cases. Never hand-interpolate YAML through the template.
- Filenames must avoid the characters Windows forbids too (`\ / : * ? " < > |`): use a colon-free
  timestamp format (e.g. `yyyy-MM-dd-HHmm`) and sanitize any title used in a path. Keep this format
  separate from the `created` datetime format.
- Cross-platform (macOS + Windows): build paths with Node `path`, never a hardcoded `/`; resolve
  home via `os.homedir()`. Accessibility permission is macOS-only — the editable-form fallback
  covers the denied-or-Windows path uniformly.
- date-fns `format`: use lowercase `yyyy`/`dd` (uppercase `YYYY`/`DD` are week-year/day-of-year and
  are guarded against); escape literal letters with single quotes, as in `'T'`.

## Docs & fast lookup

Prefer these over memory when writing extension code or answering Raycast API/tooling questions —
they are current, training data is not. Search them proactively before guessing.

- Context7 (`query-docs`): `/llmstxt/developers_raycast_llms-full_txt` — full API reference (deepest
  coverage); `/raycast/extensions` — real extension source, for "how do others do X".
- Discovery index (lists every doc page): `https://developers.raycast.com/llms.txt`.
- Key pages under `https://developers.raycast.com/`: manifest `information/manifest`; Form
  `api-reference/user-interface/form`; selection & frontmost app `api-reference/environment`;
  browser `api-reference/browser-extension`; clipboard `api-reference/clipboard`; HUD & Toast
  `api-reference/feedback/hud` + `.../toast`; preferences `api-reference/preferences`; lifecycle &
  `no-view` `information/lifecycle`; arguments `information/lifecycle/arguments`; publishing
  `basics/prepare-an-extension-for-store`.

## Before finishing

- Run and pass: `make check` (lint + test + build).
- Manually verify in Raycast via `npm run dev` — behavior depends on the Raycast runtime and
  cannot be fully covered by unit tests.

## Keeping this file current

- Treat this file as living: when you discover a durable, load-bearing fact about THIS project (a
  build/lint requirement, an API gotcha, a structural rule) that would prevent a future mistake,
  update the relevant section in the same session — after verifying it via Docs & fast lookup.
- Stay lean: keep the file under 200 lines. Before adding a line, apply "would removing this cause
  a mistake?" — if not, don't add it. When you touch a section, prune lines that went stale or
  became obvious. Growth without pruning is the main failure mode (a bloated file gets ignored).
- Do NOT put here: dependency versions, ephemeral state, or one-off session context. Session-scoped
  learnings and discovered commands belong in Claude Code auto-memory, not this file.
