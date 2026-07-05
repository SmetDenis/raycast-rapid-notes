export interface Frontmatter {
  created: string;
  tags: string[];
  title: string;
}

// A scalar is safe to emit unquoted only if it is a non-empty run of these chars.
const SAFE_SCALAR = /^[A-Za-z0-9_./-]+$/;
// Values that YAML would re-type if emitted unquoted: numbers and reserved keywords.
const NUMERIC = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const RESERVED = /^(?:true|false|null|~)$/i;

function isPlainSafe(value: string): boolean {
  return (
    value !== "" &&
    SAFE_SCALAR.test(value) &&
    !NUMERIC.test(value) &&
    !RESERVED.test(value)
  );
}

/** Render a string as a YAML scalar: plain when safe, otherwise double-quoted and escaped. */
function yamlScalar(value: string): string {
  if (isPlainSafe(value)) {
    return value;
  }
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
  return `"${escaped}"`;
}

/**
 * Build a YAML frontmatter block with a fixed minimal set of fields.
 * `created` is emitted verbatim (our controlled, colon-safe format); `title`
 * and each tag are escaped structurally. Returns the block without a trailing
 * newline; the caller composes it with the body.
 */
export function buildFrontmatter(fm: Frontmatter): string {
  const tags =
    fm.tags.length === 0 ? "[]" : `[${fm.tags.map(yamlScalar).join(", ")}]`;
  return [
    "---",
    `created: ${fm.created}`,
    `tags: ${tags}`,
    `title: ${yamlScalar(fm.title)}`,
    "---",
  ].join("\n");
}
