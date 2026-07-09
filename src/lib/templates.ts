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

/** Join the captured pieces (selection + clipboard) that form an append-note quote body. */
function quoteBody(v: TemplateVars): string {
  return [v.selected, v.clipboard].filter(Boolean).join("\n\n");
}

/** One template per output target (6 total): the four instant commands + the Form's two modes. */
export const TEMPLATES = {
  // append-checklist: a time-stamped checklist item. The DATE is NOT in the line — it
  // lives in the auto-grouped `## _date_` sub-heading (see lib/markdown.appendUnderDateGroup).
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

  // append-note: dated entry with best-effort metadata lines (each self-collapsing via the
  // `_f` forms), a comment callout carrying the typed argument (`?` when none), and the
  // captured selection quoted in a verbatim four-backtick fence (omitted when nothing was
  // captured). The trailing "---\n\n" separates consecutive entries.
  appendNote: (v) => {
    const quote = quoteBody(v);
    return (
      `- **${v.date} ${v.time}**\n` +
      v.app_f +
      v.page_f +
      `\n> [!comment]\n> ${v.extra || "?"}\n\n` +
      (quote ? `\`\`\`\`text\n${quote}\n\`\`\`\`\n\n` : "") +
      `---\n\n`
    );
  },

  // new-task: body is just the captured content.
  task: (v) => v.content,

  // new-note: content plus the source page reference.
  note: (v) => `${v.content}\n\n${v.page_f}`,

  // Rapid Note form, append mode: content plus a dated footer. No app: in the focus-stealing
  // Form the frontmost app may resolve to Raycast, so it is left out until confirmed.
  formAppend: (v) => `${v.content}\n\n_${v.date} ${v.time}_`,

  // Rapid Note form, create mode: content plus the source page reference.
  formCreate: (v) => `${v.content}\n\n${v.page_f}`,
} satisfies Record<string, TemplateFn>;
