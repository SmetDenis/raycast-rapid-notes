# Unified Append by Line-Count — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the two instant append commands into ONE command that routes a capture by shape — a single line becomes a checklist item, multi-line text becomes a note block — with both formats sharing one date-grouped insertion engine; mirror the same routing in the Form.

**Architecture:** A pure classifier (`chooseAppendFormat`) decides `note` vs `checklist` from `content.trim().includes("\n")`. Both formats now insert via the existing date-grouping engine (`applyGroupedAppend` → `prependUnderDateGroup`). The instant adapter and the Form each read a capture once, classify it, and render the matching template (`appendNote` reworked to a grouped, time-only block) into the matching target file. No new runtime dependency.

**Tech Stack:** TypeScript, React (Raycast Form), Raycast API (`@raycast/api`), date-fns, Vitest.

## Global Constraints

- All business logic lives in `src/lib/` with NO `@raycast/api` import; command files (`src/*.ts[x]`) and `src/capture.ts` / `src/shared.ts` are thin adapters and are NOT unit-tested — verify them via `make dev`. (from `CLAUDE.md`)
- No new runtime dependency (only `@raycast/api`, `@raycast/utils`, `date-fns` are allowed). (from `CLAUDE.md`)
- Tests are colocated as `src/lib/*.test.ts` and run with `vitest run` (`make test`).
- Append writes NEWEST-FIRST (prepend). Date group heading text is `_{date}_` where `{date}` = `EEE, d MMMM yyyy`. (existing behavior)
- date-fns format strings use lowercase `yyyy`/`dd`; escape literals with single quotes.
- Cross-platform paths via node `path`; never hardcode `/`.
- The manifest is `package.json`; `ray build`/`ray dev` regenerates `raycast-env.d.ts` with the `Preferences.<Command>` / `Arguments.<Command>` types. After any manifest change you MUST run `make build` (or `make dev`) to regenerate those types before type-check passes.
- Pre-finish gate: `make check` (= lint + test + build) must pass.
- We start on `main`; **create a feature branch before executing** (e.g. `git switch -c feat/unified-append`). Commit steps below run during execution, not while writing this plan.

---

## Spec

### What changes

1. **One instant command** `append` (file `src/append.ts`, manifest `name: "append"`) replaces `append-checklist` + `append-note`. It reads the capture once, classifies it, and appends to the note file or the checklist file accordingly. Both write date-grouped (`## _date_`), newest-first.
2. **Note renderer reworked.** Because notes are now grouped by date, the block header drops the date and carries only the time. Confirmed with the user: the original flat sample (`**Fri, 10 July 2026 12:58**`, no `## _date_`) is intentionally superseded by the grouped form.
   - Project marker unified to `[!!info:{project}]` (was `[!!todo:]` in the sample; checklist already uses `info`).
   - `App`/`Page` metadata rendered as bulleted lines (`- App:` / `- Page:`), built inline from raw `v.app`/`v.page` (NOT via the shared `app_f`/`page_f` vars, which `note`/`formCreate` also consume).
   - Body fence language `md` (was `text`), still four backticks (escape guard preserved).
3. **Form append mirrors the routing.** Its append mode classifies the Content field the same way and writes to one of two Form-owned targets. The old `formAppend` template (content + `_date time_` footer) is retired. The Form suppresses `app` (an open Form is itself frontmost = Raycast).
4. **Two target files per surface.** The instant command owns `noteFile`/`noteHeading` + `checklistFile`/`checklistHeading`. The Form owns `appendNoteFile`/`appendNoteHeading` + `appendChecklistFile`/`appendChecklistHeading` (standalone, duplicated by design). Splitting the two formats into separate files keeps each file homogeneous, so date groups never interleave with note blocks.

### Target note-block format (grouped)

```
# Draft Notes
## _Wed, 8 July 2026_
**14:30** `[!!info:Work]`
- App: Safari
- Page: [Great Article](https://example.com/a)

> [!comment]
> your typed argument (or `?` when none)

````md
the captured text
````

---
```

Each metadata line and the fence collapse when their source is empty; the project marker is omitted when there is no project.

### Decisions taken (user may veto during `make dev`)

- **Command name** = `append` / title `Rapid - Append (silent)`. Changeable; it only affects the manifest `name`, the entry filename `src/append.ts`, and the generated `Preferences.Append` type.
- **Target file prefs are non-required** (was `required: true` for the two old commands) with runtime guards, so a user configures only the targets they use — matches the Form pattern and `CLAUDE.md`.
- **The note block ends with `---` (no trailing newline)**, like the single-line checklist item the grouping engine already expects — this avoids a `---\n\n\n` triple-blank in the missing-group insert path. Exact blank-line count between stacked blocks is cosmetic (Obsidian renders `---` as a horizontal rule regardless); verified in `make dev`. No leading blank between a `## _date_` heading and the first block (mirrors checklist adjacency); if cramped, prepend a `\n` to the block header.
- **Form append renders from the Content field ONLY.** The append branch builds its own `vars` with `clipboard: ""`, `title: ""`, `app: ""`, `selected = values.content`. Rationale: (a) routing input (`values.content`) must equal render input, else a multi-line clipboard with single-line Content misroutes; (b) preserves current behavior — the retired `formAppend` never merged the Form's Clipboard field either; (c) `app` is Raycast in an open Form; (d) `title: ""` stops the note's Title field from leaking into the `- Page:` line as bare text. The Form's Page line therefore comes only from a filled URL field.

### Out of scope (explicitly deferred by the user)

- Fast task creation / task management — a future task.
- `new-task`, `new-note`, and the Form's **create** mode — untouched.
- Removing the now-unused `applyAppend` primitive — left in place (tested, harmless); prune later if desired.
- Whether the Form's Clipboard field should be merged into append output — it currently is not, and this plan preserves that. A separate opt-in if wanted.

### Known pre-existing risks (surfaced by review; NOT addressed here)

- **Heading search is not bounded to `bodyStart`** (`markdown.ts` `prependUnderHeading` / `prependUnderDateGroup` scan all lines). A YAML-frontmatter line shaped like an ATX heading (`# something`, a YAML comment) that also matches the configured heading text could match and insert the block inside frontmatter. Practically unreachable for the user's files (`icon`/`updated` frontmatter, no `#` lines) and pre-existing (checklist already relied on this path). Hardening (restrict the search to `bodyStart(lines)`) is a separate, optional change to the core engine + `markdown.test.ts`.
- **An H6 parent heading is unsupported** (the date sub-group clamps to H6, terminating the parent section so every append spawns a new day heading). Already documented in `CLAUDE.md`; defaults are H1. Only reachable by deliberately configuring an H6 heading.
- **`mergeSeparator: newline`** joins pieces with `\n`, so a capture with two single-line pieces (arg + selection) becomes multi-line `content` and routes to **note**. Defensible (the user chose newline separation), but worth knowing; the default `semicolon` keeps multi-piece single-line captures as checklist items.

---

## File Structure

- `src/lib/route.ts` — **new**. Pure classifier `chooseAppendFormat(content): "note" | "checklist"`. Unit-tested.
- `src/lib/route.test.ts` — **new**. Tests for the classifier.
- `src/lib/templates.ts` — **modify**. Rework `appendNote`; remove `formAppend`.
- `src/lib/templates.test.ts` — **modify**. Rewrite the `appendNote` describe; remove the `formAppend` describe.
- `src/capture.ts` — **modify**. `runSilentAppend` reworked to classify + route to one of two targets, always date-grouped.
- `src/append.ts` — **new**. Thin adapter for the merged command.
- `src/append-checklist.ts`, `src/append-note.ts` — **delete**.
- `src/rapid-note.tsx` — **modify**. Append mode classifies + routes; drop `app` state; use `applyGroupedAppend` + `appendNote`/`checklist`.
- `package.json` — **modify**. Remove two commands, add `append`; swap the Form's append prefs to two target pairs.
- `CLAUDE.md`, `README.md` — **modify**. Reflect the merged command, grouped note format, retired `formAppend`, new prefs.

---

## Task 1: Routing classifier (`lib/route.ts`)

**Files:**
- Create: `src/lib/route.ts`
- Test: `src/lib/route.test.ts`

**Interfaces:**
- Produces: `chooseAppendFormat(content: string): AppendFormat` where `type AppendFormat = "note" | "checklist"`. Consumed by `src/capture.ts` (Task 3) and `src/rapid-note.tsx` (Task 4).

- [ ] **Step 1: Write the failing test**

Create `src/lib/route.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { chooseAppendFormat } from "./route";

describe("chooseAppendFormat", () => {
  test("single line is a checklist item", () => {
    expect(chooseAppendFormat("buy milk")).toBe("checklist");
  });
  test("an internal newline makes it a note", () => {
    expect(chooseAppendFormat("line one\nline two")).toBe("note");
  });
  test("a trailing newline alone does NOT make a note (trimmed first)", () => {
    expect(chooseAppendFormat("buy milk\n")).toBe("checklist");
  });
  test("surrounding blank lines are trimmed before deciding", () => {
    expect(chooseAppendFormat("\n\nbuy milk\n\n")).toBe("checklist");
  });
  test("empty/whitespace content is a checklist (don't-care; guarded upstream)", () => {
    expect(chooseAppendFormat("")).toBe("checklist");
    expect(chooseAppendFormat("   ")).toBe("checklist");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/route.test.ts`
Expected: FAIL — cannot find module `./route` / `chooseAppendFormat is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/route.ts`:

```ts
/**
 * Classify a capture by shape to pick its append format: multi-line text (a newline survives
 * trimming) becomes a NOTE block, a single line becomes a CHECKLIST item. Trimming first means
 * a stray trailing newline or surrounding blank lines never flip the decision. Callers guard
 * empty content upstream, so "" is a don't-care (returns "checklist").
 */
export type AppendFormat = "note" | "checklist";

export function chooseAppendFormat(content: string): AppendFormat {
  return content.trim().includes("\n") ? "note" : "checklist";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/route.ts src/lib/route.test.ts
git commit -m "feat(lib): add chooseAppendFormat classifier for append routing"
```

---

## Task 2: Rework the note renderer + lock multi-line grouped insertion

**Files:**
- Modify: `src/lib/templates.ts:39-53` (the `appendNote` function + its comment)
- Test: `src/lib/templates.test.ts:90-126` (the `appendNote default` describe block)
- Test: `src/lib/note.test.ts` (add a case to the existing `applyGroupedAppend` describe)

**Interfaces:**
- Produces: `TEMPLATES.appendNote(vars)` now renders a grouped, time-only note block. Consumed by `src/capture.ts` (Task 3) and `src/rapid-note.tsx` (Task 4). Signature unchanged: `(vars: TemplateVars) => string`.
- Verifies: `applyGroupedAppend` (existing, unchanged) correctly groups a MULTI-LINE block — the whole premise of feeding a note block through the checklist grouping engine.

- [ ] **Step 1: Rewrite the failing test**

In `src/lib/templates.test.ts`, replace the whole `describe("appendNote default", …)` block (currently lines 90-126) with:

```ts
describe("appendNote default (grouped, time-only)", () => {
  test("browser + project + extra: time-only header, info project, bulleted App/Page, md fence", () => {
    const out = TEMPLATES.appendNote(
      vars({
        ...BROWSER,
        project: "Work",
        extra: "important",
        selected: "line one\nline two",
      }),
    );
    expect(out.startsWith("**14:30** `[!!info:Work]`\n")).toBe(true);
    expect(out).toContain("- App: Safari\n");
    expect(out).toContain("- Page: [Great Article](https://example.com/a)\n");
    expect(out).toContain("> [!comment]\n> important\n");
    expect(out).toContain("````md\nline one\nline two\n````");
    expect(out.endsWith("---")).toBe(true);
    expect(out).not.toContain("From app:"); // old label gone
    expect(out).not.toContain("- **"); // no bulleted date header
    expect(out).not.toContain("July"); // date is NOT in the block (it is in the group heading)
  });
  test("no project: header is time only", () => {
    const out = TEMPLATES.appendNote(vars({ ...EMPTY, selected: "quote" }));
    expect(out.startsWith("**14:30**\n")).toBe(true);
    expect(out).not.toContain("[!!info:");
  });
  test("no extra: callout falls back to ?", () => {
    const out = TEMPLATES.appendNote(
      vars({ ...TERMINAL, extra: "", selected: "quote" }),
    );
    expect(out).toContain("> [!comment]\n> ?\n");
  });
  test("non-browser: app rendered as a bullet, no Page line", () => {
    const out = TEMPLATES.appendNote(vars({ ...TERMINAL, selected: "quote" }));
    expect(out).toContain("- App: Terminal\n");
    expect(out).not.toContain("- Page:");
  });
  test("no selection/clipboard: the body fence is omitted entirely", () => {
    const out = TEMPLATES.appendNote(
      vars({ ...TERMINAL, extra: "just a thought", selected: "", clipboard: "" }),
    );
    expect(out).not.toContain("````");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: FAIL — the current `appendNote` still emits `- **Wed, 8 July 2026 14:30**`, `From app:`, `Page:`, and a ` ````text ` fence.

- [ ] **Step 3: Rewrite the implementation**

In `src/lib/templates.ts`, replace the `appendNote` comment + function (currently lines 39-53) with:

```ts
  // append (note branch): a time-only dated block for the auto-grouped `## _date_` heading.
  // The DATE lives in the group sub-heading (like checklist), so the header carries only the
  // time plus an optional `[!!info:{project}]` marker. `App`/`Page` are bulleted lines built
  // inline from the RAW vars (not the shared `app_f`/`page_f`, which `note`/`formCreate` reuse),
  // so this reformat cannot leak into other templates. A comment callout carries the typed
  // argument (`?` when none). The captured body is quoted in a four-backtick `md` fence (kept
  // four backticks so pasted ``` can't break out); it is omitted when nothing was captured.
  // Trailing `---` (with the blank line above it from the callout/fence) divides consecutive
  // blocks within a day group.
  appendNote: (v) => {
    const quote = quoteBody(v);
    const head =
      `**${v.time}**` + (v.project ? ` \`[!!info:${v.project}]\`` : "");
    return (
      `${head}\n` +
      (v.app ? `- App: ${v.app}\n` : "") +
      (v.page ? `- Page: ${v.page}\n` : "") +
      `\n> [!comment]\n> ${v.extra || "?"}\n\n` +
      (quote ? `\`\`\`\`md\n${quote}\n\`\`\`\`\n\n` : "") +
      `---`
    );
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS (the `appendNote default (grouped, time-only)` block and all others). The `formAppend` describe still passes here — it is removed in Task 4.

- [ ] **Step 5: Add a multi-line grouped-insertion test**

In `src/lib/note.test.ts`, inside the existing `describe("applyGroupedAppend", …)`, add this case (it feeds a note-block-shaped MULTI-LINE string, the whole reason this feature is safe):

```ts
  test("groups and stacks a MULTI-LINE block newest-first (note-block shape)", () => {
    const block1 = "**14:30**\n- App: Safari\n\n> [!comment]\n> ?\n\n---";
    const block2 = "**15:00**\n- App: Safari\n\n> [!comment]\n> ?\n\n---";
    const once = applyGroupedAppend("# Notes\n", "# Notes", "_D_", block1);
    expect(once).toBe("# Notes\n## _D_\n" + block1 + "\n");
    const twice = applyGroupedAppend(once, "# Notes", "_D_", block2);
    // newest block sits right under the day heading, before the older block
    expect(twice.indexOf("**15:00**")).toBeLessThan(twice.indexOf("**14:30**"));
    expect(twice).toContain("## _D_\n**15:00**");
    expect(twice.match(/## _D_/g)?.length).toBe(1); // one day group, not two
  });
```

- [ ] **Step 6: Run the note test to verify it passes**

Run: `npx vitest run src/lib/note.test.ts`
Expected: PASS — `applyGroupedAppend` splices `line` as a single element, so the block's internal newlines survive `join("\n")` and a multi-line note groups exactly like a single-line checklist item.

- [ ] **Step 7: Commit**

```bash
git add src/lib/templates.ts src/lib/templates.test.ts src/lib/note.test.ts
git commit -m "feat(templates): grouped time-only note block; test multi-line grouped insertion"
```

---

## Task 3: Unified `append` instant command

Adapters (`src/capture.ts`, `src/append.ts`) and the manifest are NOT unit-tested — the gate is a green `make build` (type-check + regenerated types), `make lint`, and a manual `make dev` pass.

**Files:**
- Modify: `package.json` (remove the `append-checklist` and `append-note` command objects; add the `append` object)
- Delete: `src/append-checklist.ts`, `src/append-note.ts`
- Create: `src/append.ts`
- Modify: `src/capture.ts` (rework `runSilentAppend`)

**Interfaces:**
- Consumes: `chooseAppendFormat` (Task 1), `TEMPLATES.appendNote` + `TEMPLATES.checklist` (Task 2), existing `applyGroupedAppend`, `buildTemplateVars`, `upsertUpdatedField`.
- Produces: `runSilentAppend(args: CommandArgs, config: RoutedAppendConfig, prefs: AppendPrefs): Promise<void>` where `interface RoutedAppendConfig { note: { file: string; heading: string }; checklist: { file: string; heading: string } }`.

- [ ] **Step 1: Replace the two manifest commands with one**

In `package.json`, delete the two command objects `"name": "append-checklist"` (lines ~17-62) and `"name": "append-note"` (lines ~63-108), and insert this single object in their place (keep `new-task`, `new-note`, `rapid-note` after it):

```json
    {
      "name": "append",
      "title": "Rapid - Append (silent)",
      "description": "Instantly append the selected or typed text: a single line becomes a checklist item, multi-line text a note block — each under its own heading, grouped by date.",
      "mode": "no-view",
      "preferences": [
        {
          "name": "noteFile",
          "title": "Note File",
          "description": "Markdown file that multi-line captures (note blocks) are appended to.",
          "type": "file",
          "required": false
        },
        {
          "name": "noteHeading",
          "title": "Note Heading",
          "description": "Append note blocks under this heading (case-insensitive), grouped by date. Leading #s set the level; plain text is H1; empty puts the date group at the top of the file (below any frontmatter).",
          "type": "textfield",
          "required": false,
          "default": "# Draft Notes"
        },
        {
          "name": "checklistFile",
          "title": "Checklist File",
          "description": "Markdown file that single-line captures (checklist items) are appended to.",
          "type": "file",
          "required": false
        },
        {
          "name": "checklistHeading",
          "title": "Checklist Heading",
          "description": "Append checklist items under this heading (case-insensitive), grouped by date. Leading #s set the level; plain text is H1; empty puts the date group at the top of the file (below any frontmatter).",
          "type": "textfield",
          "required": false,
          "default": "# Draft items"
        },
        {
          "name": "useClipboard",
          "title": "Clipboard",
          "label": "Merge the clipboard into the capture",
          "description": "When on, the clipboard is read and merged into the captured content. When off, the clipboard is never read.",
          "type": "checkbox",
          "required": false,
          "default": false
        }
      ],
      "arguments": [
        {
          "name": "text",
          "type": "text",
          "placeholder": "Extra text",
          "required": false
        },
        {
          "name": "project",
          "type": "text",
          "placeholder": "Project name",
          "required": false
        }
      ]
    },
```

- [ ] **Step 2: Delete the two old command files**

```bash
git rm src/append-checklist.ts src/append-note.ts
```

- [ ] **Step 3: Rework `runSilentAppend` in `src/capture.ts`**

Replace the entire `runSilentAppend` function (currently lines 63-134) and update the imports. Specifically:

Change the import from `./lib/note` (line 8-13) to drop `applyAppend` (still used by the Form until Task 4, so leave the export; just stop importing it here):

```ts
import { applyGroupedAppend, buildCreateFile, isEmptyCapture } from "./lib/note";
```

Add these imports near the top (after the existing `./lib/*` imports):

```ts
import { chooseAppendFormat } from "./lib/route";
import { TEMPLATES } from "./lib/templates";
```

(The existing `import { type TemplateFn } from "./lib/templates";` at line 15 becomes `import { TEMPLATES, type TemplateFn } from "./lib/templates";` — `TemplateFn` is still used by `runSilentCreate`.)

Replace the `runSilentAppend` function body with:

```ts
/** Two append targets the merged command routes between by capture shape. */
export interface RoutedAppendConfig {
  note: { file: string; heading: string };
  checklist: { file: string; heading: string };
}

/**
 * Instant append (no-view): read selection/clipboard, merge the typed argument, then CLASSIFY the
 * capture — multi-line → note block, single line → checklist item — and append it date-grouped
 * (newest-first) to the matching target, refreshing `updated` if the file has frontmatter. Bails
 * with a HUD message when nothing was captured or the routed target file is unset.
 */
export async function runSilentAppend(
  args: CommandArgs,
  config: RoutedAppendConfig,
  prefs: AppendPrefs,
): Promise<void> {
  const source = await readSource();
  const { selected, clipboard, usedClipboard } = await readInputs(
    source,
    prefs.useClipboard,
  );
  const sep = separatorGlyph(prefs.mergeSeparator);
  const content = joinParts(
    [(args.text ?? "").trim(), selected, clipboard],
    sep,
  );
  if (!content.trim()) {
    await showHUD(
      usedClipboard
        ? "Rapid Notes: nothing selected or empty clipboard"
        : "Rapid Notes: nothing selected",
    );
    return;
  }
  const format = chooseAppendFormat(content);
  const target = config[format];
  const template =
    format === "note" ? TEMPLATES.appendNote : TEMPLATES.checklist;
  if (!target.file.trim()) {
    await showHUD(`Rapid Notes: set the ${format} file in preferences`);
    return;
  }
  try {
    const now = new Date();
    const vars = buildTemplateVars({
      content,
      extra: args.text ?? "",
      selected,
      clipboard,
      url: source.url,
      title: source.title,
      app: source.app,
      project: args.project ?? "",
      now,
      dateFormat: prefs.dateFormat,
      separator: sep,
    });
    const line = template(vars);
    const current = readFile(target.file);
    const appended = applyGroupedAppend(
      current,
      target.heading,
      `_${vars.date}_`,
      line,
    );
    writeFile(
      target.file,
      upsertUpdatedField(appended, formatDate(now, prefs.dateFormat)),
    );
    await showHUD("Rapid Notes: appended");
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to append",
      message: String(error),
    });
  }
}
```

(Note: `runSilentAppend` no longer takes a `label` param and no longer branches on `groupByDate` — both formats are grouped.)

- [ ] **Step 4: Create `src/append.ts`**

```ts
import { LaunchProps, getPreferenceValues } from "@raycast/api";
import { runSilentAppend } from "./capture";

export default async function AppendCommand(
  props: LaunchProps<{ arguments: Arguments.Append }>,
) {
  const prefs = getPreferenceValues<Preferences.Append>();
  await runSilentAppend(
    props.arguments,
    {
      note: { file: prefs.noteFile ?? "", heading: prefs.noteHeading },
      checklist: {
        file: prefs.checklistFile ?? "",
        heading: prefs.checklistHeading,
      },
    },
    prefs,
  );
}
```

- [ ] **Step 5: Regenerate types and type-check**

Run: `make build`
Expected: PASS. `ray build` regenerates `raycast-env.d.ts` with `Preferences.Append` / `Arguments.Append` (and drops `Preferences.AppendChecklist` / `Preferences.AppendNote`), then type-checks. If it errors on a missing `Preferences.Append`, the manifest edit in Step 1 is malformed — fix and re-run.

- [ ] **Step 6: Lint**

Run: `make lint`
Expected: PASS (no unused imports, no orphan command files).

- [ ] **Step 7: Manual verification in Raycast**

Run: `make dev`, then in Raycast open the **Rapid - Append (silent)** command's preferences and set **Note File** and **Checklist File** to two scratch `.md` files. Verify:
  - Select a **single line** in any app → run Append → it lands as `- [ ] **HH:mm**: …` under `## _<today>_` inside `# Draft items` in the **checklist** file.
  - Select **multi-line** text → run Append → it lands as a `**HH:mm**` note block (App line, `> [!comment]`, ` ````md ` fence) under `## _<today>_` inside `# Draft Notes` in the **note** file.
  - Run each twice the same day → the second entry stacks at the TOP of its day group (newest-first), one `## _<today>_` heading.
  - Capture from a browser tab → the note block shows `- App:` and `- Page: [title](url)`.
  - Unset one target file, capture that shape → HUD "set the note/checklist file in preferences".
  - Empty capture (stray hotkey) → HUD "nothing selected".
  - If the note block reads cramped directly under the `## _date_` heading, prepend a `\n` to `head` in `appendNote` (Task 2) and re-verify.

- [ ] **Step 8: Commit**

```bash
git add package.json src/append.ts src/capture.ts
git commit -m "feat(append): merge checklist/note commands into one line-count-routed command"
```

---

## Task 4: Form append routing + retire `formAppend`

Adapter (`src/rapid-note.tsx`) is not unit-tested; the `formAppend` removal in `templates.ts`/`templates.test.ts` IS covered by the test suite. Gate: `make test` (for the template removal) + `make build` + `make lint` + manual `make dev`.

**Files:**
- Modify: `package.json` (the `rapid-note` command's `preferences`)
- Modify: `src/rapid-note.tsx` (append branch, imports, drop `app` state)
- Modify: `src/lib/templates.ts` (remove `formAppend`)
- Modify: `src/lib/templates.test.ts` (remove the `formAppend` describe)

**Interfaces:**
- Consumes: `chooseAppendFormat` (Task 1), `applyGroupedAppend`, `TEMPLATES.appendNote` + `TEMPLATES.checklist` (Task 2).

- [ ] **Step 1: Swap the Form's append prefs in the manifest**

In `package.json`, inside the `"name": "rapid-note"` command's `preferences` array, replace the two objects `"name": "appendFile"` and `"name": "appendHeading"` with these four:

```json
        {
          "name": "appendNoteFile",
          "title": "Append: Note File",
          "description": "Markdown file the form appends multi-line captures to (note blocks) in Append mode.",
          "type": "file",
          "required": false
        },
        {
          "name": "appendNoteHeading",
          "title": "Append: Note Heading",
          "description": "Append note blocks under this heading (case-insensitive), grouped by date. Leading #s set the level; plain text is H1; empty puts the date group at the top of the file (below any frontmatter).",
          "type": "textfield",
          "required": false,
          "default": "# Draft Notes"
        },
        {
          "name": "appendChecklistFile",
          "title": "Append: Checklist File",
          "description": "Markdown file the form appends single-line captures to (checklist items) in Append mode.",
          "type": "file",
          "required": false
        },
        {
          "name": "appendChecklistHeading",
          "title": "Append: Checklist Heading",
          "description": "Append checklist items under this heading (case-insensitive), grouped by date. Leading #s set the level; plain text is H1; empty puts the date group at the top of the file (below any frontmatter).",
          "type": "textfield",
          "required": false,
          "default": "# Draft items"
        },
```

- [ ] **Step 2: Remove the `formAppend` template and its test**

In `src/lib/templates.ts`, delete the `formAppend` line (currently line 62-63, including its `// Rapid Note form, append mode: …` comment on lines 61-62):

```ts
  // Rapid Note form, append mode: content plus a dated footer. No app: in the focus-stealing
  // Form the frontmost app may resolve to Raycast, so it is left out until confirmed.
  formAppend: (v) => `${v.content}\n\n_${v.date} ${v.time}_`,
```

In `src/lib/templates.test.ts`, delete the whole `describe("formAppend default", …)` block (currently lines 148-155).

- [ ] **Step 3: Run the template tests to verify green**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS — no reference to `TEMPLATES.formAppend` remains in the tests. (The `satisfies Record<string, TemplateFn>` on `TEMPLATES` still holds with one fewer entry.)

- [ ] **Step 4: Rework the Form's append branch in `src/rapid-note.tsx`**

4a. Update the `./lib/*` imports:

```ts
import { applyGroupedAppend, buildCreateFile } from "./lib/note";
import { chooseAppendFormat } from "./lib/route";
```

(Remove `applyAppend` from the `./lib/note` import; add `applyGroupedAppend` and the new `./lib/route` import. `TEMPLATES` is already imported.)

4b. Drop the now-unused `app` state. Delete line `const [app, setApp] = useState("");` and, in the `useEffect`, delete the `setApp(source.app);` line.

4c. The top-of-`handleSubmit` `vars` now serves ONLY the create branch. Since the `app` state was removed (4b), change its `app,` line to `app: "",` (create ignores `app`; this just satisfies the field):

```ts
        app: "",
```

4d. Replace the entire `else` branch of `if (create) { … } else { … }` (currently lines 131-150) with the block below. It guards empty Content (the Form has NO upstream empty-guard for append — unlike the instant path), classifies `values.content`, and builds its OWN `appendVars` so the routing input equals the render input and the Form's Clipboard/Title fields never leak into the block:

```ts
      } else {
        if (!values.content.trim()) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Nothing to append",
          });
          return;
        }
        const format = chooseAppendFormat(values.content);
        const target =
          format === "note"
            ? {
                file: prefs.appendNoteFile ?? "",
                heading: prefs.appendNoteHeading,
              }
            : {
                file: prefs.appendChecklistFile ?? "",
                heading: prefs.appendChecklistHeading,
              };
        if (!target.file.trim()) {
          await showToast({
            style: Toast.Style.Failure,
            title: `Set the append ${format} file in preferences`,
          });
          return;
        }
        // Render from the Content field ONLY: routing input (values.content) must equal render
        // input, and the Form's Clipboard/Title fields must not bleed into the block. `app` is
        // Raycast in an open Form; `title: ""` keeps the note's Title out of the `- Page:` line
        // (Page then comes only from a filled URL field).
        const appendVars = buildTemplateVars({
          content: values.content,
          extra: "",
          selected: values.content,
          clipboard: "",
          url: values.url,
          title: "",
          app: "",
          project: values.project,
          now,
          dateFormat: prefs.dateFormat,
        });
        const template =
          format === "note" ? TEMPLATES.appendNote : TEMPLATES.checklist;
        const appended = applyGroupedAppend(
          readFile(target.file),
          target.heading,
          `_${appendVars.date}_`,
          template(appendVars),
        );
        writeFile(
          target.file,
          upsertUpdatedField(appended, formatDate(now, prefs.dateFormat)),
        );
        await showToast({ style: Toast.Style.Success, title: "Appended" });
      }
```

- [ ] **Step 5: Regenerate types, type-check, lint**

Run: `make build`
Expected: PASS — `Preferences.RapidNote` now has `appendNoteFile`/`appendNoteHeading`/`appendChecklistFile`/`appendChecklistHeading` and no longer `appendFile`/`appendHeading`; `src/rapid-note.tsx` references the new names only.

Run: `make lint`
Expected: PASS — no unused `app`/`setApp`, no unused `applyAppend` import in the Form.

- [ ] **Step 6: Manual verification in Raycast**

With `make dev` running, open **Rapid - Form** preferences and set the four append targets. Then:
  - Mode = Append, type a **single line** in Content → Save → lands as a checklist item under `## _<today>_` in the checklist file.
  - Mode = Append, type **multi-line** Content → Save → lands as a note block under `## _<today>_` in the note file, with NO `- App:` line (Raycast suppressed), and a `- Page:` line only if the URL field was filled.
  - Mode = Create → unchanged (new frontmatter file, same as before).
  - Leave the routed target file empty → Toast "Set the append note/checklist file in preferences".
  - Mode = Append, empty Content → Save → Toast "Nothing to append" (no junk item written).
  - Put multi-line text in the **Clipboard** field but a single line in Content → routes to checklist and the clipboard text is NOT merged (preserved behavior; routing and render both use Content only).

- [ ] **Step 7: Commit**

```bash
git add package.json src/rapid-note.tsx src/lib/templates.ts src/lib/templates.test.ts
git commit -m "feat(form): route Form append by line-count; retire formAppend template"
```

---

## Task 5: Update docs (`CLAUDE.md`, `README.md`)

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

No tests; this task documents the shipped behavior. Make these targeted edits (search for the quoted old text, replace with the new).

- [ ] **Step 1: `CLAUDE.md` — the intro paragraph**

Replace “Four instant (`no-view`) commands — append a checklist item or text block under a heading, or create a new timestamped task/note file …” with a description of **three** instant commands: one **Append** command that routes by line-count (single line → checklist item, multi-line → note block, both date-grouped) plus **New Task** / **New Note**, and the standalone Form.

- [ ] **Step 2: `CLAUDE.md` — Architecture command list**

Replace the two bullets `src/append-checklist.ts`, `src/append-note.ts` with one:

> - `src/append.ts` — `no-view`, one command that classifies the capture via `lib/route.chooseAppendFormat` (`content.trim().includes("\n")`) and appends a checklist item (single line) or a note block (multi-line) date-grouped under the matching heading in `noteFile`/`checklistFile`.

Update the count line ("Four `no-view` … + one Form") to "Three `no-view` … + one Form".

- [ ] **Step 3: `CLAUDE.md` — Preferences section**

Update the per-target list: the Append command owns `note{File,Heading}` + `checklist{File,Heading}` (non-required, runtime-guarded); the Form owns `appendNote{File,Heading}` + `appendChecklist{File,Heading}` + `create{Directory,Frontmatter}` + `defaultTags`. Remove references to the old single `append{File,Heading}` Form target.

- [ ] **Step 4: `CLAUDE.md` — Templates section**

Update the `appendNote` description to: a **grouped**, time-only block (`**{time}**` + optional `[!!info:{project}]`) with bulleted `- App:`/`- Page:` built inline from raw vars, `> [!comment]`, a four-backtick `md` fence, trailing `---`. Remove `formAppend` from the template list and note it was retired (the Form now routes to `appendNote`/`checklist`).

- [ ] **Step 5: `CLAUDE.md` — Gotchas**

Replace the line “Append-CHECKLIST does NOT reuse `prependUnderHeading` (append-note does — leave it)” with: both the checklist and note branches now use `applyGroupedAppend` → `prependUnderDateGroup` (one date-grouped insertion engine); `prependUnderDateGroup` inserts the rendered `line` verbatim, so a multi-line note block groups the same way a single-line item does. Note that `applyAppend` (non-grouped) is now unused by the app but left in place.

- [ ] **Step 6: Update stale inline comments in `src/`**

These doc-comments now misdescribe the code (residual flagged by review); fix them:
- `src/rapid-note.tsx` (the component JSDoc): "independent of the four instant commands" → "three instant commands".
- `src/lib/note.ts` — `applyGroupedAppend`'s comment "Used only by append-checklist" → "Used by the merged append command and the Form".
- `src/lib/templates.ts` — "One template per output target (6 total)" → "(5 total)"; and the `checklist` comment's "append-checklist" → "the append command (checklist branch)".
- `src/capture.ts` — `runSilentAppend`'s JSDoc still describes a single target; reword to the classify-and-route behavior.

- [ ] **Step 7: `README.md` — Commands + formats**

- In "## Commands": replace the **Append Checklist** / **Append Note** bullets with a single **Append** bullet describing the line-count routing; update "Four instant … commands" to "Three".
- In "## What each command writes": replace the **Append Note** sample block (the flat `- **Wed, 8 July 2026 14:30**` / `From app:` / ` ````text ` version) with the grouped sample from this plan's Spec. Note the date now lives in the `## _date_` group heading and the block header carries only the time.
- Update the **Rapid Note (form)** paragraph: append mode now routes the Content field by line-count into a checklist item or a note block (no more `_date time_` footer); the app is suppressed.
- In "## Changing the output format": remove `.formAppend` from the `TEMPLATES.*` list.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md README.md src/rapid-note.tsx src/lib/note.ts src/lib/templates.ts src/capture.ts
git commit -m "docs: describe the unified line-count-routed append command; fix stale comments"
```

---

## Task 6: Final gate

- [ ] **Step 1: Run the full check**

Run: `make check`
Expected: PASS — `ray lint`, `vitest run` (route + templates + all existing suites), and `ray build` all green.

- [ ] **Step 2: Commit any residual fixups**

If `make check` surfaced anything (formatting, a missed reference), fix it, then:

```bash
git add -A
git commit -m "chore: finalize unified append (make check green)"
```

---

## Self-Review

**1. Spec coverage**
- Merge two commands into one → Task 3 (manifest + `append.ts` + `capture.ts`). ✅
- Route by `content.trim().includes("\n")` → Task 1 (`chooseAppendFormat`), wired in Tasks 3 & 4. ✅
- Note format grouped, time-only, `info` project, bulleted `App`/`Page`, `md` fence → Task 2. ✅
- Both formats date-grouped via one engine → `applyGroupedAppend` used in Tasks 3 & 4. ✅
- Two files per surface → Task 3 prefs (`noteFile`/`checklistFile`), Task 4 prefs (`appendNoteFile`/`appendChecklistFile`). ✅
- Form mirrors routing; `formAppend` retired → Task 4. ✅
- Frontmatter untouched; create/new-* untouched → not modified (out of scope). ✅
- Docs updated → Task 5. ✅

**2. Placeholder scan** — every code step contains the actual code or the exact old→new text; manual steps list concrete Raycast actions. No TBD/TODO. ✅

**3. Type consistency** — `chooseAppendFormat` returns `"note" | "checklist"`; `RoutedAppendConfig` keys are exactly `note`/`checklist`, so `config[format]` type-checks; `appendNote`/`checklist` are existing `TemplateFn`s; new pref keys (`noteFile`, `noteHeading`, `checklistFile`, `checklistHeading` on `append`; `appendNoteFile`, `appendNoteHeading`, `appendChecklistFile`, `appendChecklistHeading` on `rapid-note`) match between manifest and adapter reads. ✅

**4. Outside-review pass (blind, different model family)** — folded in:
- Form empty-input guard added (Task 4, Step 4d). ✅
- Form routing/render mismatch + Clipboard/Title leak fixed via a dedicated `appendVars` (Task 4). ✅
- Multi-line grouped-insertion now tested (Task 2, Step 5); note block ends with `---` (no trailing `\n`) to avoid a triple-blank. ✅
- Pref-description text corrected re. the empty-heading behavior (Tasks 3 & 4). ✅
- Stale `src/` comments scheduled for update (Task 5, Step 6). ✅
- Pre-existing risks (unbounded heading search vs frontmatter; H6 parent; `mergeSeparator: newline` routing) documented in Spec → "Known pre-existing risks", deliberately NOT addressed here.

**Known residual (flagged in Spec):** `applyAppend` + its `note.test.ts` suite become unused after Task 4; left in place deliberately. Prune in a separate cleanup if desired.
