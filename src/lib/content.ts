export type MergeSeparator = "semicolon" | "space" | "newline";

const SEPARATOR_GLYPHS: Record<MergeSeparator, string> = {
  semicolon: "; ",
  space: " ",
  newline: "\n",
};

/**
 * Resolve the `mergeSeparator` preference enum to the glyph inserted between a typed argument and
 * the captured text: `semicolon` → "; " (readable), `space` → " ", `newline` → "\n". An unknown
 * value falls back to the semicolon default.
 */
export function separatorGlyph(choice: string): string {
  return (
    SEPARATOR_GLYPHS[choice as MergeSeparator] ?? SEPARATOR_GLYPHS.semicolon
  );
}

/**
 * Join the parts whose trimmed value is non-empty, with `sep` between adjacent kept parts. Each
 * kept part contributes its value VERBATIM (so a code fence can wrap it exactly); callers trim the
 * pieces they want trimmed (e.g. the typed argument) before passing them in.
 */
export function joinParts(parts: string[], sep: string): string {
  return parts.filter((p) => p.trim() !== "").join(sep);
}
