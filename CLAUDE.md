# rapid-notes — Claude Code instructions

Raycast extension (TypeScript/React) for fast note capture. Four capture operations, each an
instant (`no-view`) command plus one shared editable Form (`rapid-note`): append a checklist item
or a text block under a heading in a file, or create a new timestamped task/note file with YAML
frontmatter. Template- and preference-driven. Local/personal for now; may be published to the
Raycast Store later.

## Critical

- Keep ALL business logic in `src/lib/` free of any `@raycast/api` import. Command files are thin
  adapters that call `lib`. Reason: `@raycast/api` only runs inside Raycast, so anything importing
  it is not unit-testable — `lib` is where logic and tests live.
- This tool is deliberately minimal (append checklist/note + create task/note, instant or via one
  shared Form). Push back on feature creep and over-engineering before adding any command, option, or
  dependency.
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

- Command entry points (thin adapters). Four `no-view` (instant, hotkey-friendly) commands + one Form:
  - `src/append-checklist.ts`, `src/append-note.ts` — `no-view`, append under a heading in a file.
  - `src/new-task.ts`, `src/new-note.ts` — `no-view`, create a new frontmatter file in a directory.
  - `src/rapid-note.tsx` — `view` Form; a target dropdown `{checklist|append|task|note}` adapts the
    fields (append → content/project; create → also title/tags) and dispatches to `lib`.
  - `src/capture.ts` — non-command adapter helper (`@raycast/api`): `runSilentAppend`/`runSilentCreate`
    shared by the four `no-view` commands. Not in `lib`, not unit-tested — verify via `make dev`.
- `src/lib/` — pure core, no `@raycast/api`: template/placeholder rendering, date + timestamp-filename
  formatting, Markdown append (to file end or under a configurable heading), new-note + YAML frontmatter
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
  Target `file`/`directory` prefs are non-required with NO default (→ generated type
  `string | undefined`) and runtime-guarded, so the user configures only the targets they use.

## Preferences (extension-level, namespaced per target)

- All prefs are extension-level so a target's `no-view` command and the Form read identical config.
  NO global template — each target owns its file/dir + template (+ heading for append, frontmatter
  for create). Keys: `checklist{File,Heading,Template}`, `appendNote{File,Heading,Template}`,
  `task{Directory,Template,Frontmatter}`, `note{Directory,Template,Frontmatter}`; shared
  `dateFormat`, `filenameDateFormat`, `defaultTags`, `clipboardFallback`, `mergeSeparator`.
- Template placeholders (all built in `lib/vars.buildTemplateVars`): each captured field has a RAW
  form (trimmed, no label, `""` when empty) and a FORMATTED form (a labeled line ending in `\n`,
  `""` when empty — so it vanishes cleanly; the baked-in `\n` means it can't sit inline).
  Raw: `{content}` `{url}` `{title}` `{app}` `{project}` `{page}`; formatted: `{content_f}` `{url_f}`
  `{title_f}` `{app_f}` `{project_f}` `{page_f}`; plus `{date}` (`EEE, d MMMM yyyy`) `{time}` (`HH:mm`)
  `{datetime}` (the `dateFormat` pref). Labels: `From app: …` / `Url: <…>` / `Title: …` /
  `Project: …` / `Page: …`. `{app}` is the
  frontmost source-app name (ANY app, not just browsers). `{page}` is an adaptive Markdown link:
  `[title](url)`, else `<url>`, else the title, else `""`. `{content_f}` wraps the content VERBATIM
  in a four-backtick `text` code fence so pasted triple-backtick blocks can't break out.
  Templates interpret `\n`/`\t`/`\\` escapes in the TEMPLATE
  only (single-line prefs can't hold real newlines); escapes inside substituted values stay literal.
  Trim policy: the capture is returned VERBATIM (`readSelectionOrClipboard` no longer trims);
  `buildTemplateVars` trims the raw forms and `{content_f}` stays as-is; emptiness is judged on the
  trimmed value. Rendered template output is NEVER trimmed, so intentional template `\n` survives.
  Defaults: checklist `- [ ] **{date} {time}**: {content}`; append-note `{content}\n\n_{date} {time} · {app}_`;
  task body `{content}`; note body `{content}\n\n{page_f}`. `{project}` reaches an APPEND target only if
  its template references it (default templates don't → a project passed to
  append is silently dropped, by design); in CREATE it is structural (title prefix + `project:`
  field). No `{clipboard}` placeholder — commands prefill `{content}` from the
  selection; only when the `clipboardFallback` preference is ON do they fall back to the clipboard
  if the selection is empty (for non-AX apps like Telegram) — this applies to Silent too. The
  manual "paste clipboard" action (Form only) always appends.
- Create (New Task / New Note) writes YAML frontmatter — generated STRUCTURALLY in `lib`
  (`buildCreateFile`), never from the template — then the body template. Field order: configurable
  static fields from the `*Frontmatter` pref (`parseExtraFrontmatter`, `key: value; key2: value2`;
  defaults `type: task; task_status: active` / `type: note`) → `created` → `title` → `project` →
  `tags` → `source_url` (`title`/`project`/`source_url` omitted when empty). `title` is built by
  `composeCreateTitle`: `{project}: ` prefix when project present + a `{date} {time}` fallback when the
  user title is empty (so a create ALWAYS has a title). The filename is the timestamp, so an untitled
  note is still identifiable.
- The append commands, when their target already has frontmatter, refresh an `updated` field to now
  (same `dateFormat` as `created`) via `upsertUpdatedField`; files without frontmatter are left
  untouched (no block injected). New Rapid Note ALWAYS writes a fresh file (never merges), so it has
  no `updated`.
- `dateFormat` (default `yyyy-MM-dd'T'HH:mm:ss`) → `created` + `{datetime}`; `filenameDateFormat`
  (default `yyyy-MM-dd-HHmmss`) → create filenames. Raycast prefs have no textarea — comma/semicolon
  lists live in single-line `textfield`s.
- Default tags: a comma-separated `textfield`. Create uses it — the Form prefills its tags field
  (prefill/replace, not merge); the Silent create commands read it directly.
- Arguments (optional single-line, via `LaunchProps`): `text` merges with the capture into one
  `{content}` via `lib/content.mergeCapturedContent` (argument-first, separator only when BOTH
  present, capture verbatim, nullish → empty); `mergeSeparator` → `separatorGlyph`: `semicolon`
  (default `"; "`) / `space` / `newline`. `project` (all commands) feeds `{project}`; create commands
  also take a `title` argument (3-arg Raycast limit). `text` always feeds `{content}`, never the title.

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
  heading-missing, multiple-matching-headings, and empty-file cases. The heading pref is parsed
  by `lib/note.parseHeadingPref` into `{level, text}` (leading `#`s ⇒ level, bare text ⇒ H1);
  `lib/markdown.appendUnderHeading(content, level, text, line)` matches at the EXACT level and
  case-insensitively, and the section ends at the next heading of ANY level (a nested sub-heading
  closes it — it is NOT kept inside).
- YAML frontmatter (create) is the other bug-prone piece — two layers: (1) structural fields
  (`title`/`project`/`source_url`/tags, `:`/`#`/quotes/spaces) escape via `yamlScalar`; (2) the user's
  `*Frontmatter` pref (`parseExtraFrontmatter`) must FAIL LOUDLY (throw → HUD/Toast + abort, never
  silent-corrupt) on a segment without `:`, an empty/reserved key
  (`created/title/project/tags/source_url/updated`), or a duplicate — a `;` inside a value is
  unsupported and also fails loud. Never hand-interpolate YAML through the template.
- Empty-input guard (create): the title always has a `{date} {time}` fallback, so it can't gate
  emptiness — `lib/note.isEmptyCapture` runs on content AND title AND project (all blank ⇒ abort) so a
  stray hotkey can't leave a junk file; a title-only or project-only capture is valid.
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

- Context7 (`query-docs`): `/raycast/extensions` — real extension source, for "how do others do X".
  CAUTION: `/llmstxt/developers_raycast_llms-full_txt` has HALLUCINATED Raycast specifics (non-existent
  `"silent"` command mode, fake argument `loadOptions`) — verify anything from it against the official
  pages below (`jina read_url`) or `gh`, which are authoritative.
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
