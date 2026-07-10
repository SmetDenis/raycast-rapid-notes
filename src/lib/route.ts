/**
 * Classify a capture by shape to pick its append format: multi-line text (a newline survives
 * trimming) becomes a NOTE block, a single line becomes a CHECKLIST item. Trimming first means
 * a stray trailing newline or surrounding blank lines never flip the decision. Callers guard
 * empty content upstream, so "" is a don't-care (returns "checklist").
 */
export type AppendFormat = "note" | "checklist";

export function chooseAppendFormat(content: string): AppendFormat {
  return content.trim().includes("\n") ? "note" : "checklist";
}
