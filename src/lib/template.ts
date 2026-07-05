export type TemplateVars = Record<string, string>;

/**
 * Interpret backslash escapes in a template. Raycast preferences are single-line
 * textfields, so a newline can only be written as the two characters `\n`; this turns
 * `\n`/`\t`/`\r` into the real control chars and `\\` into a single backslash (so a
 * literal `\n` can still be written as `\\n`). Unknown escapes are left untouched.
 */
export function unescapeTemplate(template: string): string {
  return template.replace(/\\([nrt\\])/g, (_match, ch: string) => {
    switch (ch) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      default:
        return "\\"; // ch === "\\"
    }
  });
}

/**
 * Replace `{key}` placeholders with values from `vars` in a single pass, after
 * interpreting escapes in the TEMPLATE (never in the substituted values, so a literal
 * `\n` inside captured text stays literal). Unknown placeholders are left untouched,
 * and text introduced by a substitution is never re-processed.
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return unescapeTemplate(template).replace(
    /\{(\w+)\}/g,
    (match, key: string) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}
