export interface Frontmatter {
  /** Configurable static fields (e.g. type/task_status), emitted first, in order. */
  extra: FrontmatterField[];
  created: string;
  /** Emitted only when non-empty. */
  title: string;
  /** Emitted as `project:` only when non-empty. */
  project: string;
  tags: string[];
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

export interface FrontmatterField {
  key: string;
  value: string;
}

// Structural keys the composer emits itself — a user's extra-frontmatter pref must not set
// them (would duplicate/clash), so we reject them loudly rather than let YAML corrupt silently.
const RESERVED_KEYS = new Set([
  "created",
  "title",
  "project",
  "tags",
  "source_url",
  "updated",
]);

/**
 * Parse the configurable frontmatter preference `key: value; key2: value2` into ordered
 * fields. Segments split on `;` (empty ones ignored); each splits on its FIRST `:` so values
 * may contain colons. Throws LOUDLY (the caller surfaces the message via HUD/Toast and aborts
 * the write) on a malformed segment, an empty key, a reserved structural key, or a duplicate
 * key. A `;` inside a value is unsupported and surfaces as a malformed-segment error rather
 * than silent corruption.
 */
export function parseExtraFrontmatter(pref: string): FrontmatterField[] {
  const fields: FrontmatterField[] = [];
  const seen = new Set<string>();
  for (const segment of pref.split(";")) {
    const trimmed = segment.trim();
    if (trimmed === "") continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      throw new Error(`Invalid frontmatter field (no ":"): "${trimmed}"`);
    }
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (key === "") {
      throw new Error(`Invalid frontmatter field (empty key): "${trimmed}"`);
    }
    const lower = key.toLowerCase();
    if (RESERVED_KEYS.has(lower)) {
      throw new Error(
        `Frontmatter key "${key}" is reserved and set automatically`,
      );
    }
    if (seen.has(lower)) {
      throw new Error(`Duplicate frontmatter key "${key}"`);
    }
    seen.add(lower);
    fields.push({ key, value });
  }
  return fields;
}

/**
 * Build a YAML frontmatter block. Order: the configurable `extra` fields first, then
 * `created`, `title`, `project`, `tags`, `source_url`. `created` and `tags` are always
 * present; `title`, `project` and `source_url` appear only when non-empty. `created` is
 * emitted verbatim (our controlled, colon-safe format); every `extra` value, `title`,
 * `project`, `source_url` and each tag are escaped structurally via `yamlScalar`. Returns
 * the block without a trailing newline; the caller composes it with the body.
 */
export function buildFrontmatter(fm: Frontmatter): string {
  const tags =
    fm.tags.length === 0 ? "[]" : `[${fm.tags.map(yamlScalar).join(", ")}]`;
  const lines = ["---"];
  for (const { key, value } of fm.extra) {
    lines.push(`${key}: ${yamlScalar(value)}`);
  }
  lines.push(`created: ${fm.created}`);
  if (fm.title) lines.push(`title: ${yamlScalar(fm.title)}`);
  if (fm.project) lines.push(`project: ${yamlScalar(fm.project)}`);
  lines.push(`tags: ${tags}`);
  if (fm.sourceUrl) lines.push(`source_url: ${yamlScalar(fm.sourceUrl)}`);
  lines.push("---");
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
