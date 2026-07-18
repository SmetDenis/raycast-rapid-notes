# rapid-notes — Claude Code instructions

Raycast extension (TypeScript/React) for fast note capture. Three instant (`no-view`) commands —
one **Append** command that routes a capture by line-count (single line → checklist item, multi-line
→ note block, both date-grouped under their own heading), plus **New Task** / **New Note** that create
a timestamped task/note file with YAML frontmatter — plus a STANDALONE editable Form (`rapid-note`)
with its own append/create targets. Output formats live in code (`lib/templates.ts`), not preferences.
Local/personal for now; may be published to the Raycast Store later.

## Critical

- Keep ALL business logic in `src/lib/` free of any `@raycast/api` import. Command files are thin
  adapters that call `lib`. Reason: `@raycast/api` only runs inside Raycast, so anything importing
  it is not unit-testable — `lib` is where logic and tests live.
- EXHAUSTIVE combinatorial test coverage is MANDATORY, not best-effort. Any behaviour switched by a
  preference/option/argument (`useSelection`, `useClipboard`, `mergeSeparator`, `project`, terminal
  vs AX vs browser source, empty vs multi-line, heading set/unset, …) must be tested across ALL
  combinations of the flags it INTERACTS with — never "spot-checked", never assumed. Enumerate the
  interacting inputs, take their cross-product, and assert every cell — including EVERY unhappy path
  (empty/whitespace capture, missing target file/dir, malformed frontmatter, stale-selection leak,
  terminal-empty error). Ortho­gonal knobs that provably don't interact (e.g. `dateFormat` ×
  `useSelection`) are tested in their own module, NOT crossed — crossing them is noise, not coverage.
  Verify branch coverage by making the code testable (extract a pure planner into `lib` — see
  `lib/plan.ts`), NOT by mocking `@raycast/api`. If a branch is hard to reach in a test, that is a
  design smell: make the logic pure first. "Probably covered" is a defect; enumerate and prove it.
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

- Command entry points (thin adapters). Three `no-view` (instant, hotkey-friendly) commands + one Form:
  - `src/append.ts` — `no-view`, one command that classifies the capture via
    `lib/route.chooseAppendFormat` (`content.trim().includes("\n")`) and appends a checklist item
    (single line) or a note block (multi-line) date-grouped under the matching heading in
    `noteFile`/`checklistFile`.
  - `src/new-task.ts`, `src/new-note.ts` — `no-view`, create a new frontmatter file in a directory.
  - `src/rapid-note.tsx` — `view` Form, a STANDALONE command with its OWN prefs (not a dispatcher): a
    mode dropdown `{append|create}` appends (routed by line-count to `appendNoteFile`/`appendChecklistFile`)
    or creates in `createDirectory`; no arguments.
  - `src/capture.ts` — THIN non-command adapter (`@raycast/api`): `runSilentAppend`/`runSilentCreate`
    read selection/clipboard, delegate the whole decision to `lib/plan.plan*`, then switch on the
    returned discriminated outcome to do the I/O (`readFile`/`writeFile`) and UI (Toast: green
    `Success` on write, red `Failure` on every non-write outcome). No
    business logic here — verify the I/O/UI wiring via `make dev`.
- `src/lib/` — pure core, no `@raycast/api`: output templates as functions of a vars object
  (`templates.ts` + `vars.ts`), date + timestamp-filename formatting, Markdown prepend (NEWEST-FIRST:
  to the file top below frontmatter, or to the top of a configurable heading's section), new-note +
  YAML frontmatter composition (escaping-safe), tag parsing, browser-app detection, and the
  capture→decision PLANNERS (`plan.ts`: `planSilentAppend`/`planSilentCreate`/`planFormAppend`/
  `planFormCreate` — content merge + shape routing + rendering + empty/missing branches — returning
  a discriminated `*Plan` the adapters switch on; this is where the append bug-site is unit-tested).
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
  frontmatter for create): the `append` command owns `note{File,Heading}` + `checklist{File,Heading}`
  (non-required, runtime-guarded — a shape whose file is unset HUDs an error), `task*`/`note*` +
  `defaultTags` (create commands), and the Form's `appendNote{File,Heading}` +
  `appendChecklist{File,Heading}` + `create{Directory,Frontmatter}` + `defaultTags` (own duplicated
  paths, by design; exact keys in `package.json`). Only `dateFormat`, `filenameDateFormat`,
  `mergeSeparator` stay extension-scope; `useClipboard` is command-scope on all 4. `useSelection` is
  command-scope on `append` ONLY (default OFF; create commands always read the selection — no toggle).
  `defaultTags` is the same key in 3 scopes (task, note, form) — namespaced per command.
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
  reaches APPEND via the `[!!info:{project}]` marker (both checklist AND appendNote render it); in CREATE
  it is structural (title prefix + `project:` field).
- Templates ARE FUNCTIONS `(vars) => string` in `lib/templates.TEMPLATES`, NOT strings/prefs — editing a
  function (then `make dev`) is the only way to change output; real JS renders cleanly across every
  capture branch. `capture.ts` and the Form both classify the capture (`lib/route.chooseAppendFormat`)
  and pick `appendNote`/`checklist` accordingly; the Form calls the chosen template + `formCreate` in
  `handleSubmit`. Current templates (5 total): checklist = `**HH:mm**:` (date is in the auto-grouped
  `## _date_` heading) + optional `[!!info:{project}]` prefix + body (`extra_code`, `selected`,
  `clipboard` via `sep`) + inline `link`/`(app)`, continuations 4-space indented (`indentContinuation`);
  appendNote = grouped time-only block `**HH:mm**` + optional `[!!info:{project}]` + bulleted `- App:`/
  `- Page:` (built inline from RAW `app`/`page`, NOT the shared `app_f`/`page_f`) + `> [!comment]`
  (`extra`|`?`) + four-backtick `md` fence + trailing `---`; task = `content`; note/formCreate =
  `content` + `page_f`. `formAppend` was RETIRED — the Form now routes to `appendNote`/`checklist`.
- `content` = `extra + selection + clipboard` (present pieces only, `mergeSeparator` between) via
  `lib/content.joinParts` for the three instant commands; the Form uses its Content field verbatim
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
- Arguments (optional single-line, via `LaunchProps`; the three instant commands ONLY — the Form takes
  NONE): `text` is the `extra` var and joins the `content` merge via `lib/content.joinParts` (present
  pieces only, separator between adjacent kept pieces, capture verbatim); `mergeSeparator` →
  `separatorGlyph`: `semicolon` (default `"; "`) / `space` / `newline`. `project` (all three) feeds
  the `project` var; the create commands also take a `title` argument (3-arg limit).

## Gotchas

- `getSelectedText()` REJECTS (throws) when nothing is selected — it never returns an empty string.
  Wrap in try/catch and treat rejection as empty. Needs macOS Accessibility permission. It reads via
  the AX API with a Cmd+C fallback that needs the SOURCE app frontmost, so non-AX apps (Telegram,
  Electron) work only in `no-view` (Silent), NOT in a focus-stealing Form. The Form therefore prefills
  Content from `readSelection` and shows a separate editable Clipboard field from `readClipboardText`,
  gated by the `useClipboard` preference.
- Silent (`no-view`) command: never render a VIEW (no Form/Detail/List); give feedback via
  `showToast` — green `Toast.Style.Success` on a write, red `Toast.Style.Failure` on empty input /
  missing target / exception, then exit. (HUD unused here — it can't be colored. CAVEAT, UNVERIFIED:
  docs say `showToast` falls back to `showHUD` when no window is open, which a hotkey-launched no-view
  command has none of — if that fallback fires, BOTH the color AND the `message` second line are lost
  (regression vs the old single-string HUDs). Verify in `make dev` by triggering via the real global
  HOTKEY — NOT root-search typing, which opens a window and masks the fallback.) APPEND reads
  selection/clipboard from TWO orthogonal opt-in toggles
  (`readCaptureInputs`): `useSelection` (default OFF) reads the selection, `useClipboard` (default
  OFF) reads the clipboard. Default-off matters — a stray selection still highlighted in an editor
  (e.g. the previous checklist line in Obsidian) MUST NOT auto-merge into the new item; that
  compounding leak was the reason append's selection became opt-in. Pass text as the `text` argument
  when both are off. Create commands (New Task / New Note) have NO `useSelection` toggle and ALWAYS
  read the selection — they are EXPERIMENTAL (rarely used, to be reworked), keeping prior behaviour.
- GPU terminals (Ghostty, kitty, Alacritty, WezTerm, cmux, agterm) hide the selection from BOTH AX and the Cmd+C
  fallback (in a terminal Cmd+C = SIGINT) → `getSelectedText()` returns "" (verified: Ghostty
  `sel=0`). Silent capture detects them by bundleId (`lib/terminal.isNonAxTerminal`, needs
  `Source.bundleId`), skips the selection reader, and reads the clipboard as the selection surrogate
  when EITHER `useSelection` OR `useClipboard` is on — relies on the terminal's `copy-on-select`
  (Ghostty must be `= clipboard`, NOT `true`: `true` uses the selection clipboard, invisible to
  `Clipboard.readText()`). `readCaptureInputs` returns `inTerminal`; append raises a red Failure
  Toast (HUDs can't be red) when a terminal capture came back empty. Native AX terminals
  (Terminal.app, iTerm2) EXCLUDED: reading their clipboard risks a stale/dup merge.
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
  frontmatter (NEVER above — corrupts it + the later `updated` refresh; shared `bodyStart`). This
  `prependUnderHeading`/`prependToTop` path is the non-grouped `applyAppend` primitive (now unused);
  live appends go through the date-grouped engine below, whose null-pref branch reuses the same
  top-below-frontmatter insertion.
- BOTH append branches (checklist AND note) now use `lib/note.applyGroupedAppend` → `prependUnderDateGroup`
  — one date-grouped insertion engine. It splices the rendered `line` as a SINGLE element, so a multi-line
  note block groups exactly like a single-line checklist item. It finds/creates a `## _{date}_` sub-heading
  (level parent+1, clamped H6; parent@H6 unsupported). NEWEST-FIRST at BOTH levels: a found group takes the
  item right after its heading; a MISSING group is created at the parent-section TOP (before older groups),
  trailing blank line only when the section had content. DISTINCT boundary: parent ends at the next heading
  of level ≤ parent (date groups don't close it); MISSING parent bootstraps at file END. Null pref ⇒
  top-level `# _{date}_` (missing group created at the file top below frontmatter); dup ⇒ first. The
  non-grouped `lib/note.applyAppend` is now UNUSED by the app but kept (tested, harmless) — prune later.
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
- When a change touches any option/flag/argument: enumerate the interacting inputs, take their
  cross-product, and confirm a test asserts EVERY cell — happy AND unhappy paths (see the exhaustive
  combinatorial-coverage rule in Critical). Do not claim coverage from spot-checks.
- Manually verify in Raycast via `npm run dev` — runtime behavior isn't covered by unit tests.

## Keeping this file current

- Treat this file as living: on discovering a durable, load-bearing fact (build/lint requirement,
  API gotcha, structural rule) that prevents a future mistake, update the section the same session.
- Stay lean (under 200 lines): before adding a line ask "would removing this cause a mistake?"; prune
  stale/obvious lines when you touch a section. Growth without pruning is the main failure mode.
- Do NOT put here: dependency versions, ephemeral state, one-off context — use Claude Code auto-memory.
