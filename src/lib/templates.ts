import { renderTemplate, type TemplateVars } from "./template";

// Built-in default templates as FUNCTIONS of the full variable object, not strings.
// Rationale: a function has full JS control (conditionals, fallbacks, self-collapsing
// punctuation) that the `{key}` string engine can't express — so a default can render
// cleanly across every capture branch (browser / non-browser / empty) WITHOUT bloating
// the shared `TemplateVars` with narrow one-shot forms. User templates from preferences
// stay plain `{key}` strings (see `renderTemplateOrDefault`); the resulting asymmetry
// (smart default vs simpler custom string) is intentional and documented. No
// `@raycast/api` import → this lives in lib and is unit-tested.

export type TemplateFn = (vars: TemplateVars) => string;

/** Join the captured pieces (selection + clipboard) that form an append-note quote body. */
function quoteBody(v: TemplateVars): string {
  return [v.selected, v.clipboard].filter(Boolean).join("\n\n");
}

/** One default per template preference (6 total), mapped 1:1 to the package.json prefs. */
export const DEFAULT_TEMPLATES = {
  // append-checklist: a single dated checklist line. Source (link/app) is inlined with
  // self-collapsing punctuation so an empty piece never leaves a stray space or "()".
  checklist: (v) =>
    `- [ ] **${v.date} ${v.time}** ${v.content}` +
    (v.url ? ` [link](${v.url})` : "") +
    (v.app ? ` (${v.app})` : ""),

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

/**
 * Resolve and render the body: the user's preference as a `{key}` string template (via
 * `renderTemplate`, so its `\n` escapes are interpreted) when it holds any non-whitespace
 * text, otherwise the built-in default FUNCTION called with the same variables. Only the
 * emptiness test is trimmed; a custom template's intentional whitespace survives.
 */
export function renderTemplateOrDefault(
  pref: string | undefined,
  defaultTemplate: TemplateFn,
  vars: TemplateVars,
): string {
  return pref && pref.trim() !== ""
    ? renderTemplate(pref, vars)
    : defaultTemplate(vars);
}
