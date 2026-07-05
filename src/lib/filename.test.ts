import { describe, expect, test } from "vitest";
import { sanitizeFilename, noteFilename } from "./filename";

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

describe("noteFilename", () => {
  test("appends the .md extension to a clean stamp", () => {
    expect(noteFilename("2026-07-05-1432")).toBe("2026-07-05-1432.md");
  });

  test("sanitizes the stamp before adding the extension", () => {
    expect(noteFilename("2026-07-05T14:32")).toBe("2026-07-05T14-32.md");
  });
});
