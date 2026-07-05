import { describe, expect, test } from "vitest";
import { mergeCapturedContent, separatorGlyph } from "./content";

describe("separatorGlyph", () => {
  test("maps the three preference enums to their glyphs", () => {
    expect(separatorGlyph("semicolon")).toBe("; ");
    expect(separatorGlyph("space")).toBe(" ");
    expect(separatorGlyph("newline")).toBe("\n");
  });

  test("falls back to the semicolon glyph for an unknown/empty value", () => {
    expect(separatorGlyph("")).toBe("; ");
    expect(separatorGlyph("bogus")).toBe("; ");
  });
});

describe("mergeCapturedContent", () => {
  const SEP = "; ";

  test("joins argument and captured with the separator when both are present", () => {
    expect(mergeCapturedContent("важное", "дедлайн в пятницу", SEP)).toBe(
      "важное; дедлайн в пятницу",
    );
  });

  test("returns the argument alone when nothing is captured", () => {
    expect(mergeCapturedContent("just a typed note", "", SEP)).toBe(
      "just a typed note",
    );
  });

  test("returns captured alone, verbatim, when no argument is typed", () => {
    expect(mergeCapturedContent("", "  selected text  ", SEP)).toBe(
      "  selected text  ",
    );
  });

  test("treats a nullish argument as empty", () => {
    expect(mergeCapturedContent(undefined, "selected", SEP)).toBe("selected");
  });

  test("returns the captured value as-is when neither side has real text", () => {
    expect(mergeCapturedContent("", "", SEP)).toBe("");
    // whitespace-only on both sides: argument is dropped, captured returned verbatim
    // (the caller's `content.trim()` check is what treats this as empty).
    expect(mergeCapturedContent("   ", "  \n ", SEP)).toBe("  \n ");
  });

  test("trims the argument but keeps captured verbatim after the separator", () => {
    expect(mergeCapturedContent("  note  ", "  body  ", SEP)).toBe(
      "note;   body  ",
    );
  });

  test("keeps a multi-line captured block intact with the newline separator", () => {
    expect(mergeCapturedContent("summary", "line1\nline2", "\n")).toBe(
      "summary\nline1\nline2",
    );
  });
});
