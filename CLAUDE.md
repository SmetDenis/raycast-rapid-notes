# rapid-notes — Claude Code instructions

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
- `make build` — compile check + full type-check (→ `ray build -e dist`).
- `make lint` / `make fix` — lint / autofix (→ `ray lint` / `ray lint --fix`).
- `make test` — unit tests (→ `vitest run`); `make test-watch` for watch mode.
- `make check` — lint + test + build (the pre-finish gate).
- `make install` — install dependencies. Package manager underneath: npm (Raycast default).

## Architecture

- Command entry points (thin adapters, one file each):
  - `src/append-note.tsx` — `view` mode, Form (edit before save).
  - `src/append-note-silent.ts` — `no-view` mode, instant save + `showHUD`.
  - `src/new-note.tsx` — `view` mode, Form.
- `src/lib/` — pure core, no `@raycast/api`: template/placeholder rendering, date + timestamp-filename
  formatting, Markdown append (to file end or under an H1 heading), new-note + YAML frontmatter
  composition (escaping-safe), tag parsing, browser-app detection.
- `src/shared.ts` — the non-command adapter (`@raycast/api` + `node:fs`): selection/clipboard and
  browser/app capture (`readSource`, `readSelectionOrClipboard`) plus file read/write. Not in `lib`,
  so not unit-tested — verify via `make dev`.
- Tests colocated as `src/lib/*.test.ts`.
- `assets/` — command icons (512×512 PNG + `@dark` variant), rasterized from the editable
  `icon.svg`/`icon@dark.svg` sources via `rsvg-convert -w 512 -h 512 icon.svg -o icon.png`. Edit the
  SVG and re-render; do not hand-edit the PNG.
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
- Template placeholders (all built in `lib/vars.buildTemplateVars`): each captured field has a RAW
  form (trimmed, no label, `""` when empty) and a FORMATTED form (a labeled line ending in `\n`,
  `""` when empty — so it vanishes cleanly; the baked-in `\n` means it can't sit inline).
  Raw: `{content}` `{url}` `{title}` `{app}` `{page}`; formatted: `{content_f}` `{url_f}` `{title_f}`
  `{app_f}` `{page_f}`; plus `{date}` (`EEE, d MMMM yyyy`) `{time}` (`HH:mm`) `{datetime}` (the
  `dateFormat` pref). Labels: `From app: …` / `Url: <…>` / `Title: …` / `Page: …`. `{app}` is the
  frontmost source-app name (ANY app, not just browsers). `{page}` is an adaptive Markdown link:
  `[title](url)`, else `<url>`, else the title, else `""`. `{content_f}` wraps the content VERBATIM
  in a four-backtick `text` code fence so pasted triple-backtick blocks can't break out.
  Templates interpret `\n`/`\t`/`\\` escapes in the TEMPLATE
  only (single-line prefs can't hold real newlines); escapes inside substituted values stay literal.
  Trim policy: the capture is returned VERBATIM (`readSelectionOrClipboard` no longer trims);
  `buildTemplateVars` trims the raw forms and `{content_f}` stays as-is; emptiness is judged on the
  trimmed value. Rendered template output is NEVER trimmed, so intentional template `\n` survives.
  Defaults: append `- [ ] {content}`; new-note body `{content}` (the title lives in frontmatter,
  not a body heading). No `{clipboard}` placeholder — commands prefill `{content}` from the
  selection; only when the `clipboardFallback` preference is ON do they fall back to the clipboard
  if the selection is empty (for non-AX apps like Telegram) — this applies to Silent too. The
  manual "paste clipboard" action (Form only) always appends.
- New Rapid Note only: writes YAML frontmatter — generated structurally in `lib` (NOT from the
  template) — then the body template. Fields: `created` (ISO local datetime), `tags` (YAML list,
  empty ⇒ `[]`), `title` (omitted when empty), `source_url` (browser URL; omitted when empty), and
  fixed `type: task` + `task_status: active`. Tags/title come from the Form; the filename uses the
  timestamp, so an untitled note is still identifiable.
- The append commands, when their target already has frontmatter, refresh an `updated` field to now
  (same `dateFormat` as `created`) via `upsertUpdatedField`; files without frontmatter are left
  untouched (no block injected). New Rapid Note ALWAYS writes a fresh file (never merges), so it has
  no `updated`.
- Date format: a `textfield` preference holding a date-fns format string; default
  `yyyy-MM-dd'T'HH:mm:ss`; applies to `created` and `{datetime}`. Raycast preferences have no
  textarea type — comma-separated values live in single-line `textfield`s.
- Default tags: a comma-separated `textfield` preference. The New Rapid Note form prefills its tags
  field from it; the user edits per note (prefill/replace, not merge).
- Inline `text` argument (all three commands, optional single-line Raycast argument, read via
  `LaunchProps`): the typed text MERGES with the capture into one `{content}` through
  `lib/content.mergeCapturedContent` — argument-first (`arg + sep + capture`), separator only when
  BOTH are present, capture kept verbatim, nullish argument treated as empty. The `mergeSeparator`
  dropdown pref picks the glyph via `lib/content.separatorGlyph`: `semicolon` (default ⇒ `"; "`) /
  `space` / `newline`. The argument always feeds `{content}` (never new-note's title); Silent's
  empty-check runs on the merged value, so a typed argument alone satisfies it.

## Gotchas

- `getSelectedText()` REJECTS (throws) when nothing is selected — it never returns an empty string.
  Wrap in try/catch and treat rejection as empty. Needs macOS Accessibility permission. It reads via
  the AX API with a Cmd+C fallback that needs the SOURCE app frontmost, so non-AX apps (Telegram,
  Electron) work only in `no-view` (Silent), NOT in a focus-stealing Form. Form commands therefore
  offer `readSelectionOrClipboard` (selection first, clipboard last, gated by the `clipboardFallback`
  preference) plus the manual "paste clipboard".
- Silent (`no-view`) command: never render UI; give feedback via `showHUD`, and on empty input show
  a HUD error and exit. It reads the selection, auto-reading the clipboard ONLY when the
  `clipboardFallback` preference is ON (then the empty HUD reads "nothing selected or empty
  clipboard"). Silent commits immediately, so clipboard auto-read stays behind that opt-in.
- Browser URL/title are best-effort and captured ONLY when the frontmost app is a browser
  (`getFrontmostApplication` + `lib/browser.isBrowserApp`), so a selection from another app never
  grabs an unrelated background tab. Gate the read with `environment.canAccess(BrowserExtension)`
  (cleaner than a throw); the active tab is the one with `active === true`. Not available on Windows.
- Form `defaultValue` is applied once per component lifecycle — prefill the selection via
  `defaultValue`, not `value`.
- Markdown heading insertion is the most bug-prone piece: explicitly define and test the
  heading-missing, multiple-matching-headings, and empty-file cases.
- YAML frontmatter (New Rapid Note) is the other bug-prone piece: `title`/`source_url` can contain
  `:`, `#`, or quotes and tags can contain spaces — quote/escape structurally (all via `yamlScalar`)
  and test special-char titles, empty tags, and multi-tag cases. Never hand-interpolate YAML through
  the template.
- Filenames must avoid the characters Windows forbids too (`\ / : * ? " < > |`): default is a
  colon-free `yyyy-MM-dd-HHmmss` (seconds ⇒ collisions near-impossible; `uniqueFilename` adds a
  `-2`/`-3` suffix on the rare clash so a note is never overwritten/merged). Sanitize any title used
  in a path; keep this format separate from the `created` datetime format.
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
