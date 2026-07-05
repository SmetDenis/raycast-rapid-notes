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
  test("inserts at the end of the section, before the next H1", () => {
    const input = "# Inbox\n- a\n\n# Done\n- b\n";
    expect(appendUnderHeading(input, "Inbox", "- c")).toBe(
      "# Inbox\n- a\n- c\n\n# Done\n- b\n",
    );
  });

  test("inserts at the end of a section that runs to EOF", () => {
    expect(appendUnderHeading("# Inbox\n- a\n", "Inbox", "- c")).toBe(
      "# Inbox\n- a\n- c\n",
    );
  });

  test("inserts right after an empty heading section", () => {
    expect(appendUnderHeading("# Inbox\n# Done\n", "Inbox", "- c")).toBe(
      "# Inbox\n- c\n# Done\n",
    );
  });

  test("creates the section at the end when the heading is missing", () => {
    expect(appendUnderHeading("# Other\n- a\n", "Inbox", "- c")).toBe(
      "# Other\n- a\n\n# Inbox\n- c\n",
    );
  });

  test("creates the heading in an empty file", () => {
    expect(appendUnderHeading("", "Inbox", "- c")).toBe("# Inbox\n- c\n");
  });

  test("matches only an exact H1, not an H2 with the same text", () => {
    expect(appendUnderHeading("## Inbox\n- a\n", "Inbox", "- c")).toBe(
      "## Inbox\n- a\n\n# Inbox\n- c\n",
    );
  });

  test("adds a missing trailing newline when inserting at EOF", () => {
    expect(appendUnderHeading("# Inbox\n- a", "Inbox", "- c")).toBe(
      "# Inbox\n- a\n- c\n",
    );
  });
});
