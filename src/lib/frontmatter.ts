export interface Frontmatter {
  created: string;
  tags: string[];
  /** Emitted only when non-empty. */
  title: string;
  /** Source URL; emitted as `source_url` only when non-empty. */
  sourceUrl: string;
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
 * Build a YAML frontmatter block. `created`, `tags`, `type` and `task_status` are
 * always present (`type`/`task_status` are fixed constants); `title` and `source_url`
 * appear only when non-empty. `created` is emitted verbatim (our controlled, colon-safe
 * format); `title`, `source_url` and each tag are escaped structurally. Returns the
 * block without a trailing newline; the caller composes it with the body.
 */
export function buildFrontmatter(fm: Frontmatter): string {
  const tags =
    fm.tags.length === 0 ? "[]" : `[${fm.tags.map(yamlScalar).join(", ")}]`;
  const lines = ["---", `created: ${fm.created}`, `tags: ${tags}`];
  if (fm.title) lines.push(`title: ${yamlScalar(fm.title)}`);
  if (fm.sourceUrl) lines.push(`source_url: ${yamlScalar(fm.sourceUrl)}`);
  lines.push("type: task", "task_status: active", "---");
  return lines.join("\n");
}

/**
 * Set the `updated` field (verbatim, like `created`) in an EXISTING frontmatter block,
 * inserting it right after `created` (or at the block's end) when absent. Content that
 * does not start with a complete `---`…`---` block is returned unchanged — we never inject
 * frontmatter into a plain file. The `updated` value should already be a colon-safe string.
 */
export function upsertUpdatedField(content: string, updated: string): string {
  const lines = content.split("\n");
  if (lines[0] !== "---") return content;
  const end = lines.indexOf("---", 1);
  if (end === -1) return content;

  const fm = lines.slice(1, end);
  const line = `updated: ${updated}`;
  const at = fm.findIndex((l) => /^updated:/.test(l));
  if (at !== -1) {
    fm[at] = line;
  } else {
    const createdAt = fm.findIndex((l) => /^created:/.test(l));
    fm.splice(createdAt === -1 ? fm.length : createdAt + 1, 0, line);
  }
  return [lines[0], ...fm, ...lines.slice(end)].join("\n");
}
