# rapid-notes — Claude Code instructions

Raycast extension (TypeScript/React) for fast note capture. Four instant (`no-view`) commands —
append a checklist item or text block under a heading, or create a new timestamped task/note file
with YAML frontmatter — plus a STANDALONE editable Form (`rapid-note`) with its own append/create
targets. Output formats live in code (`lib/templates.ts`), not preferences. Local/personal for now;
may be published to the Raycast Store later.

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
- `make build` — compile check + full type-check, emits the built extension to `./dist`
  (→ `ray build -e dist -o dist`); `dist/` is git-ignored.
- `make lint` / `make fix` — lint / autofix (→ `ray lint` / `ray lint --fix`).
- `make test` — unit tests (→ `vitest run`); `make test-watch` for watch mode.
- `make check` — lint + test + build (the pre-finish gate).
- `make install` — install dependencies. Package manager underneath: npm (Raycast default).

## Architecture

- Command entry points (thin adapters). Four `no-view` (instant, hotkey-friendly) commands + one Form:
  - `src/append-checklist.ts`, `src/append-note.ts` — `no-view`, append under a heading in a file.
  - `src/new-task.ts`, `src/new-note.ts` — `no-view`, create a new frontmatter file in a directory.
  - `src/rapid-note.tsx` — `view` Form, a STANDALONE command with its OWN prefs (not a dispatcher): a
    mode dropdown `{append|create}` appends under a heading in `appendFile` or creates in `createDirectory`; no arguments.
  - `src/capture.ts` — non-command adapter helper (`@raycast/api`): `runSilentAppend`/`runSilentCreate`
    shared by the four `no-view` commands. Not in `lib`, not unit-tested — verify via `make dev`.
- `src/lib/` — pure core, no `@raycast/api`: output templates as functions of a vars object
  (`templates.ts` + `vars.ts`), date + timestamp-filename formatting, Markdown prepend (NEWEST-FIRST:
  to the file top below frontmatter, or to the top of a configurable heading's section), new-note +
  YAML frontmatter composition (escaping-safe), tag parsing, browser-app detection.
- `src/shared.ts` — the non-command adapter (`@raycast/api` + `node:fs`): selection/clipboard and
  browser/app capture (`readSource`, `readSelection`, `readClipboardText`) plus file read/write. Not in `lib`,
  so not unit-tested — verify via `make dev`.
- Tests colocated as `src/lib/*.test.ts`.
- `assets/` — command icons (512×512 PNG + `@dark` variant), rasterized from the editable
  `icon.svg`/`icon@dark.svg` sources via `rsvg-convert -w 512 -h 512 icon.svg -o icon.png`. Edit the
  SVG and re-render; do not hand-edit the PNG.
- The manifest is `package.json` (Raycast superset): it defines commands, their `mode`, and both
  command-scope and extension-scope `preferences`, and is the source of truth for command/preference keys.
  Required fields (needed for `ray build`/`ray lint`, not just Store): `name`, `title`,
  `description`, `icon`, `author`, `platforms`, `categories`, `commands`; `license` MIT
  recommended. Preference types include `file` and `directory` — use them for the append target
  file and the new-note directory. Command code reads prefs via the generated
  `Preferences.<Command>` types (in git-ignored `raycast-env.d.ts`, produced by `ray build`/`dev`).
  Target `file`/`directory` prefs are non-required with NO default (→ generated type
  `string | undefined`) and runtime-guarded, so the user configures only the targets they use.

## Preferences (per-target = command-scope; a few invariants = extension-scope)

- Per-target prefs are COMMAND-scope (each on that command's OWN settings screen; a command reads only
  its own command-scope prefs + inherited extension-scope, never another command's — the Form and the
  instant commands do NOT share config). Each target owns its file/dir (+ heading for append,
  frontmatter for create): `checklist*`/`appendNote*` (append commands), `task*`/`note*` +
  `defaultTags` (create commands), and the Form's `append{File,Heading}` +
  `create{Directory,Frontmatter}` + `defaultTags` (own duplicated paths, by design; exact keys
  in `package.json`). Only `dateFormat`, `filenameDateFormat`, `mergeSeparator` stay extension-scope;
  `useClipboard` is command-scope on all 5. `defaultTags` is the same key in 3 scopes (task, note, form) — namespaced per command.
- Template vars (the palette the template functions draw from; all built in
  `lib/vars.buildTemplateVars`, listed in README): capture TRIO (`content`/`selected`/`clipboard`) each
  has a RAW form (trimmed, `""` when empty), an `_f` twin (labeled line ending in `\n`, self-collapsing
  — except `content_f`, a four-backtick `text` fence wrapping content VERBATIM so pasted backticks can't
  break out), and an `_inline` twin (`\s+`→space). Others: `extra` (+ `extra_code` twin = `extra` in an
  inline-code span)/`project`, source `url`/`title`/`app`/`page`/`link` (each with an `_f` twin); `tags`
  bare (feeds YAML) vs `tags_f` `#`-prefixed; `sep` = `mergeSeparator` glyph; `date` (`EEE, d MMMM
  yyyy`)/`time` (`HH:mm`)/`datetime` (the `dateFormat` pref). `page` adapts
  `[title](url)`/`<url>`/title/`""`. Trim policy: capture VERBATIM; raw
  forms trimmed, `content_f` as-is, emptiness on trimmed value; rendered output NEVER trimmed. `project`
  reaches APPEND only if that template references it (checklist DOES, via the `[!!info:{project}]`
  prefix; appendNote doesn't → dropped); in CREATE it is structural (title prefix + `project:` field).
- Templates ARE FUNCTIONS `(vars) => string` in `lib/templates.TEMPLATES`, NOT strings/prefs — editing a
  function (then `make dev`) is the only way to change output; real JS renders cleanly across every
  capture branch. Command files pass the fn to `capture.ts`; the Form calls `formAppend`/`formCreate` in
  `handleSubmit`. Current templates: checklist = `**HH:mm**:` (date is in the auto-grouped `## _date_`
  heading) + optional `[!!info:{project}]` prefix + body (`extra_code`, `selected`, `clipboard` via
  `sep`) + inline `link`/`(app)`, continuations 4-space indented (`indentContinuation`); appendNote =
  dated block + `app_f`/`page_f` + `> [!comment]` (`extra`|`?`) + fence + `---`; task = `content`;
  note/formCreate = `content` + `page_f`; formAppend = `content` + dated footer (NO app — Form may
  resolve `app`="Raycast").
- `content` = `extra + selection + clipboard` (present pieces only, `mergeSeparator` between) via
  `lib/content.joinParts` for the four instant commands; the Form uses its Content field verbatim
  (`selected` == `content` there). Clipboard participates only when `useClipboard` is ON.
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
  untouched (no block injected). Create ALWAYS writes a fresh file (never merges), so it has
  no `updated`.
- `dateFormat` (default `yyyy-MM-dd'T'HH:mm:ss`) → `created`/`updated` + the `datetime` var; `filenameDateFormat`
  (default `yyyy-MM-dd-HHmmss`) → create filenames. Raycast prefs have no textarea — comma/semicolon
  lists live in single-line `textfield`s.
- Default tags: a comma-separated `textfield` (task/note/form scopes). Create uses it — the Form
  prefills its Tags field (replace, not merge), the Silent create commands read it directly — feeding
  both the `tags:` frontmatter and the `tags`/`tags_f` vars. Silent APPEND has no tag source → `tags` empty.
- Arguments (optional single-line, via `LaunchProps`; the four instant commands ONLY — the Form takes
  NONE): `text` is the `extra` var and joins the `content` merge via `lib/content.joinParts` (present
  pieces only, separator between adjacent kept pieces, capture verbatim); `mergeSeparator` →
  `separatorGlyph`: `semicolon` (default `"; "`) / `space` / `newline`. `project` (all four) feeds
  the `project` var; the create commands also take a `title` argument (3-arg limit).

## Gotchas

- `getSelectedText()` REJECTS (throws) when nothing is selected — it never returns an empty string.
  Wrap in try/catch and treat rejection as empty. Needs macOS Accessibility permission. It reads via
  the AX API with a Cmd+C fallback that needs the SOURCE app frontmost, so non-AX apps (Telegram,
  Electron) work only in `no-view` (Silent), NOT in a focus-stealing Form. The Form therefore prefills
  Content from `readSelection` and shows a separate editable Clipboard field from `readClipboardText`,
  gated by the `useClipboard` preference.
- Silent (`no-view`) command: never render UI; give feedback via `showHUD`, and on empty input show
  a HUD error and exit. It reads the selection, merging the clipboard ONLY when the
  `useClipboard` preference is ON (then the empty HUD reads "nothing selected or empty
  clipboard"). Silent commits immediately, so the clipboard read stays behind that opt-in.
- GPU terminals (Ghostty, kitty, Alacritty, WezTerm, cmux) hide the selection from BOTH AX and the Cmd+C
  fallback (in a terminal Cmd+C = SIGINT) → `getSelectedText()` returns "" (verified: Ghostty
  `sel=0`). Silent capture detects them by bundleId (`lib/terminal.isNonAxTerminal`, needs
  `Source.bundleId`) and reads the clipboard REGARDLESS of `useClipboard`, skipping the selection
  (`readCaptureInputs`) — relies on the terminal's `copy-on-select` (Ghostty must be `= clipboard`,
  NOT `true`: `true` uses the selection clipboard, invisible to `Clipboard.readText()`). Native AX
  terminals (Terminal.app, iTerm2) EXCLUDED: reading their clipboard risks a stale/dup merge.
- Browser URL/title are best-effort and captured ONLY when the frontmost app is a browser
  (`getFrontmostApplication` + `lib/browser.isBrowserApp`), so a selection from another app never
  grabs an unrelated background tab. Gate the read with `environment.canAccess(BrowserExtension)`
  (cleaner than a throw); the active tab is the one with `active === true`. Not available on Windows.
- Form `defaultValue` is applied once per component lifecycle — prefill the selection via
  `defaultValue`, not `value`.
- Append writes NEWEST-FIRST (prepend), the most bug-prone piece: test heading-missing,
  multiple-matching-headings, and empty-file cases. Heading pref → `lib/note.parseHeadingPref` `{level,
  text}` (leading `#`s ⇒ level, bare ⇒ H1). `lib/markdown.prependUnderHeading` matches EXACT level,
  case-insensitively, and inserts right AFTER the heading (section top); a MISSING heading bootstraps at
  the file END. Null pref ⇒ `lib/markdown.prependToTop`, inserting at the file top BELOW any `---…---`
  frontmatter (NEVER above — corrupts it + the later `updated` refresh; shared `bodyStart`). `prependToTop`
  is the Form append DEFAULT (`appendHeading` default `""`).
- Append-CHECKLIST does NOT reuse `prependUnderHeading` (append-note does — leave it): it groups by day via
  `lib/note.applyGroupedAppend` → `prependUnderDateGroup`, finding/creating a `## _{date}_` sub-heading
  (level parent+1, clamped H6; parent@H6 unsupported). NEWEST-FIRST at BOTH levels: a found group takes the
  item right after its heading; a MISSING group is created at the parent-section TOP (before older groups),
  trailing blank line only when the section had content. DISTINCT boundary: parent ends at the next heading
  of level ≤ parent (date groups don't close it); MISSING parent bootstraps at file END. Null pref ⇒
  top-level `# _{date}_` (missing group created at the file top below frontmatter); dup ⇒ first.
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

Prefer these over memory for Raycast API/tooling questions — current where training data is stale; search before guessing.

- Context7 (`query-docs`): `/raycast/extensions` — real extension source, for "how do others do X".
  CAUTION: `/llmstxt/developers_raycast_llms-full_txt` HALLUCINATES Raycast specifics (fake `"silent"`
  mode, fake arg `loadOptions`) — verify against the official pages below (`jina read_url`) or `gh`.
- Discovery index (lists every doc page): `https://developers.raycast.com/llms.txt`.
- Key pages under `https://developers.raycast.com/`: manifest `information/manifest`; Form
  `api-reference/user-interface/form`; selection & frontmost app `api-reference/environment`;
  browser `api-reference/browser-extension`; clipboard `api-reference/clipboard`; HUD & Toast
  `api-reference/feedback/hud` + `.../toast`; preferences `api-reference/preferences`; lifecycle &
  `no-view` `information/lifecycle`; arguments `information/lifecycle/arguments`.

## Before finishing

- Run and pass: `make check` (lint + test + build).
- Manually verify in Raycast via `npm run dev` — runtime behavior isn't covered by unit tests.

## Keeping this file current

- Treat this file as living: on discovering a durable, load-bearing fact (build/lint requirement,
  API gotcha, structural rule) that prevents a future mistake, update the section the same session.
- Stay lean (under 200 lines): before adding a line ask "would removing this cause a mistake?"; prune
  stale/obvious lines when you touch a section. Growth without pruning is the main failure mode.
- Do NOT put here: dependency versions, ephemeral state, one-off context — use Claude Code auto-memory.
