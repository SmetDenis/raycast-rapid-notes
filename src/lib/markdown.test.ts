import { describe, expect, test } from "vitest";
import { appendToEnd, appendUnderHeading } from "./markdown";

describe("appendToEnd", () => {
  test("writes the line to an empty file", () => {
    expect(appendToEnd("", "- x")).toBe("- x\n");
  });

  test("appends after content that ends with a newline", () => {
    expect(appendToEnd("a\n", "- x")).toBe("a\n- x\n");
  });

  test("adds a missing trailing newline before appending", () => {
    expect(appendToEnd("a", "- x")).toBe("a\n- x\n");
  });
});

describe("appendUnderHeading", () => {
  test("inserts at the end of the section, before the next heading", () => {
    const input = "# Inbox\n- a\n\n# Done\n- b\n";
    expect(appendUnderHeading(input, 1, "Inbox", "- c")).toBe(
      "# Inbox\n- a\n- c\n\n# Done\n- b\n",
    );
  });

  test("inserts at the end of a section that runs to EOF", () => {
    expect(appendUnderHeading("# Inbox\n- a\n", 1, "Inbox", "- c")).toBe(
      "# Inbox\n- a\n- c\n",
    );
  });

  test("inserts right after an empty heading section", () => {
    expect(appendUnderHeading("# Inbox\n# Done\n", 1, "Inbox", "- c")).toBe(
      "# Inbox\n- c\n# Done\n",
    );
  });

  test("creates the section at the end when the heading is missing", () => {
    expect(appendUnderHeading("# Other\n- a\n", 1, "Inbox", "- c")).toBe(
      "# Other\n- a\n\n# Inbox\n- c\n",
    );
  });

  test("creates the heading in an empty file", () => {
    expect(appendUnderHeading("", 1, "Inbox", "- c")).toBe("# Inbox\n- c\n");
  });

  test("matches the level exactly, not an H2 with the same text", () => {
    expect(appendUnderHeading("## Inbox\n- a\n", 1, "Inbox", "- c")).toBe(
      "## Inbox\n- a\n\n# Inbox\n- c\n",
    );
  });

  test("adds a missing trailing newline when inserting at EOF", () => {
    expect(appendUnderHeading("# Inbox\n- a", 1, "Inbox", "- c")).toBe(
      "# Inbox\n- a\n- c\n",
    );
  });

  test("matches an exact H2 heading and appends inside it", () => {
    expect(appendUnderHeading("## Tasks\n- a\n", 2, "Tasks", "- c")).toBe(
      "## Tasks\n- a\n- c\n",
    );
  });

  test("matches case-insensitively, keeping the file's original case", () => {
    expect(appendUnderHeading("## tasks\n- a\n", 2, "Tasks", "- c")).toBe(
      "## tasks\n- a\n- c\n",
    );
  });

  test("ends the section at the next heading of any level", () => {
    expect(
      appendUnderHeading("## Tasks\n- a\n### Sub\n- b\n", 2, "Tasks", "- c"),
    ).toBe("## Tasks\n- a\n- c\n### Sub\n- b\n");
  });

  test("matches markdown heading text case-insensitively", () => {
    expect(
      appendUnderHeading("## **Title**\n- a\n", 2, "**title**", "- c"),
    ).toBe("## **Title**\n- a\n- c\n");
  });

  test("creates a missing heading at the configured level", () => {
    expect(appendUnderHeading("# Other\n- a\n", 3, "Notes", "- c")).toBe(
      "# Other\n- a\n\n### Notes\n- c\n",
    );
  });

  test("ends an H1 section at a nested sub-heading (behaviour change)", () => {
    expect(
      appendUnderHeading(
        "# Inbox\n- a\n## Sub\n- b\n# Done\n",
        1,
        "Inbox",
        "- c",
      ),
    ).toBe("# Inbox\n- a\n- c\n## Sub\n- b\n# Done\n");
  });
});
