export type TemplateVars = Record<string, string>;

/**
 * Replace `{key}` placeholders with values from `vars` in a single pass.
 * Unknown placeholders (keys not in `vars`) are left untouched, and text
 * introduced by a substitution is never re-processed.
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}
