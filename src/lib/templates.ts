import { joinParts } from "./content";
import { indentContinuation } from "./markdown";
import type { TemplateVars } from "./vars";

// The output templates as FUNCTIONS of the full variable object, not strings. There is no
// user-facing template preference: these functions ARE the templates, and editing them here
// (then `make dev`) is the way to change a command's output. A function has full JS control
// (conditionals, fallbacks, self-collapsing punctuation) that a `{key}` string could not
// express, so each renders cleanly across every capture branch (browser / non-browser /
// empty). The `vars` bag (built in `lib/vars.buildTemplateVars`) is the palette to draw from.
// No `@raycast/api` import → this lives in lib and is unit-tested.

export type TemplateFn = (vars: TemplateVars) => string;

/** Join the captured pieces (selection + clipboard) that form the note-block quote body. */
function quoteBody(v: TemplateVars): string {
  return [v.selected, v.clipboard].filter(Boolean).join("\n\n");
}

/** One template per output shape (5 total): append note/checklist, create task/note, formCreate. */
export const TEMPLATES = {
  // the append command (checklist branch): a time-stamped checklist item. The DATE is NOT in the line — it
  // lives in the auto-grouped `## _date_` sub-heading (see lib/markdown.prependUnderDateGroup).
  // Body is recomposed from the raw pieces (not `content`) so `extra` renders first as an
  // inline-code span and `project` as an `[!!info:]` prefix; pieces join with the merge
  // separator, source (link/app) is inlined self-collapsing, and multi-line content has its
  // continuations indented 4 spaces to stay inside the bullet.
  checklist: (v) => {
    const body = joinParts([v.extra_code, v.selected, v.clipboard], v.sep);
    const prefix = v.project ? `\`[!!info:${v.project}]\`` : "";
    const head = [prefix, body].filter(Boolean).join(" ");
    return indentContinuation(
      `- [ ] **${v.time}**: ${head}` +
        (v.url ? ` [link](${v.url})` : "") +
        (v.app ? ` (${v.app})` : ""),
    );
  },

  // append (note branch): a time-only dated block for the auto-grouped `## _date_` heading.
  // The DATE lives in the group sub-heading (like checklist), so the header carries only the
  // time plus an optional `[!!info:{project}]` marker. `App`/`Page` are bulleted lines built
  // inline from the RAW `v.app`/`v.page` (not `page_f`, which `note`/`formCreate` still consume),
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

  // new-task: body is just the captured content.
  task: (v) => v.content,

  // new-note: content plus the source page reference.
  note: (v) => `${v.content}\n\n${v.page_f}`,

  // Rapid Note form, create mode: content plus the source page reference.
  formCreate: (v) => `${v.content}\n\n${v.page_f}`,
} satisfies Record<string, TemplateFn>;
