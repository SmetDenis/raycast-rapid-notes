/**
 * Parse a comma-separated tag string into a clean, de-duplicated list.
 * Trims each entry, drops empties, strips a leading `#` (which would start a
 * YAML comment), and preserves first-occurrence order.
 */
export function parseTags(csv: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of csv.split(",")) {
    const tag = raw.trim().replace(/^#+/, "").trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}
