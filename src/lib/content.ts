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
 * Merge a typed inline argument with captured text (selection, or the clipboard fallback) into a
 * single content value. Argument-first: `argument + sep + captured`. The argument is trimmed; the
 * captured text is preserved VERBATIM (so `{content_f}` can wrap it exactly). The separator is
 * inserted only when BOTH sides have real text; when only one side does, that side is returned
 * alone. A nullish argument (Raycast may pass `undefined` for an empty optional field) is treated
 * as empty. Emptiness is judged on the trimmed value; the returned string is never trimmed.
 */
export function mergeCapturedContent(
  argument: string | undefined,
  captured: string,
  sep: string,
): string {
  const a = (argument ?? "").trim();
  const hasCaptured = captured.trim() !== "";
  if (a && hasCaptured) return a + sep + captured;
  if (a) return a;
  return captured;
}
