import { describe, expect, test } from "vitest";
import { joinParts, separatorGlyph } from "./content";

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

describe("joinParts", () => {
  const SEP = "; ";

  test("joins all present parts with the separator, in order", () => {
    expect(joinParts(["extra", "sel", "clip"], SEP)).toBe("extra; sel; clip");
  });

  test("skips empty/whitespace-only parts (no leading/trailing separator)", () => {
    expect(joinParts(["", "sel", "   "], SEP)).toBe("sel");
    expect(joinParts(["extra", "", "clip"], SEP)).toBe("extra; clip");
  });

  test("returns the lone present part with no separator", () => {
    expect(joinParts(["", "only", ""], SEP)).toBe("only");
  });

  test("returns '' when every part is empty or whitespace", () => {
    expect(joinParts(["", "  ", "\n"], SEP)).toBe("");
  });

  test("keeps each present part verbatim but tests emptiness on the trimmed value", () => {
    expect(joinParts([" a ", "b\n", ""], "|")).toBe(" a |b\n");
  });
});
