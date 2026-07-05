import { describe, expect, test } from "vitest";
import { sanitizeFilename, uniqueFilename } from "./filename";

describe("sanitizeFilename", () => {
  test("replaces characters forbidden on Windows with a dash", () => {
    expect(sanitizeFilename('a:b/c\\d*e?f"g<h>i|j')).toBe(
      "a-b-c-d-e-f-g-h-i-j",
    );
  });

  test("collapses runs of replaced characters into a single dash", () => {
    expect(sanitizeFilename("a///b")).toBe("a-b");
  });

  test("trims leading/trailing dashes and whitespace", () => {
    expect(sanitizeFilename("  :name:  ")).toBe("name");
  });
});

describe("uniqueFilename", () => {
  test("returns the plain sanitized stamp + .md when nothing collides", () => {
    expect(uniqueFilename("2026-07-05T14:32:09", () => false)).toBe(
      "2026-07-05T14-32-09.md",
    );
  });

  test("adds a numeric suffix until it finds a free name", () => {
    const taken = new Set(["note.md", "note-2.md"]);
    expect(uniqueFilename("note", (name) => taken.has(name))).toBe("note-3.md");
  });
});
