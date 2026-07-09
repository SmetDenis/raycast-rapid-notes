import { describe, expect, test } from "vitest";
import {
  appendToEnd,
  appendUnderDateGroup,
  appendUnderHeading,
  indentContinuation,
} from "./markdown";

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

describe("indentContinuation", () => {
  test("leaves a single-line item unchanged", () => {
    expect(indentContinuation("- x")).toBe("- x");
  });

  test("indents continuation lines by four spaces", () => {
    expect(indentContinuation("- a\nb\nc")).toBe("- a\n    b\n    c");
  });

  test("leaves blank continuation lines bare (no trailing whitespace)", () => {
    expect(indentContinuation("- a\n\nb")).toBe("- a\n\n    b");
  });

  test("respects a custom indent width", () => {
    expect(indentContinuation("- a\nb", 2)).toBe("- a\n  b");
  });
});

describe("appendUnderDateGroup", () => {
  const P = { level: 1, text: "Checklist" };

  test("(1) parent exists, no groups yet: creates the group in the parent section", () => {
    expect(appendUnderDateGroup("# Checklist\n", P, "_D_", "- c")).toBe(
      "# Checklist\n## _D_\n- c\n",
    );
  });

  test("(2) today's group is last: appends to the end of the group", () => {
    expect(
      appendUnderDateGroup("# Checklist\n## _D_\n- a\n", P, "_D_", "- b"),
    ).toBe("# Checklist\n## _D_\n- a\n- b\n");
  });

  test("(3) today's group is not last: appends inside it, order preserved", () => {
    expect(
      appendUnderDateGroup(
        "# Checklist\n## _D1_\n- a\n\n## _D2_\n- b\n",
        P,
        "_D1_",
        "- c",
      ),
    ).toBe("# Checklist\n## _D1_\n- a\n- c\n\n## _D2_\n- b\n");
  });

  test("(4) another H1 after the section: new group goes before it", () => {
    expect(
      appendUnderDateGroup(
        "# Checklist\n## _D_\n- a\n\n# Archive\n- z\n",
        P,
        "_E_",
        "- c",
      ),
    ).toBe("# Checklist\n## _D_\n- a\n\n## _E_\n- c\n\n# Archive\n- z\n");
  });

  test("(5) parent is null, non-empty file: creates an H1 date group at the end", () => {
    expect(appendUnderDateGroup("some text\n", null, "_D_", "- c")).toBe(
      "some text\n\n# _D_\n- c\n",
    );
  });

  test("(6) empty file + parent: creates parent and group", () => {
    expect(appendUnderDateGroup("", P, "_D_", "- c")).toBe(
      "# Checklist\n## _D_\n- c\n",
    );
  });

  test("(7) duplicate date groups: appends to the first", () => {
    expect(
      appendUnderDateGroup(
        "# Checklist\n## _D_\n- a\n\n## _D_\n- b\n",
        P,
        "_D_",
        "- c",
      ),
    ).toBe("# Checklist\n## _D_\n- a\n- c\n\n## _D_\n- b\n");
  });

  test("(8) multi-line line is inserted verbatim", () => {
    expect(
      appendUnderDateGroup(
        "# Checklist\n## _D_\n- a\n",
        P,
        "_D_",
        "- b\n    cont",
      ),
    ).toBe("# Checklist\n## _D_\n- a\n- b\n    cont\n");
  });

  test("(9) parent is null, empty file: creates an H1 date group", () => {
    expect(appendUnderDateGroup("", null, "_D_", "- c")).toBe("# _D_\n- c\n");
  });

  test("(10) group has multi-line items: new item lands after the continuations", () => {
    expect(
      appendUnderDateGroup(
        "# Checklist\n## _D_\n- a\n    cont\n",
        P,
        "_D_",
        "- b",
      ),
    ).toBe("# Checklist\n## _D_\n- a\n    cont\n- b\n");
  });

  test("(11) matches the group text case-insensitively, keeping file case", () => {
    expect(
      appendUnderDateGroup("# Checklist\n## _d_\n- a\n", P, "_D_", "- b"),
    ).toBe("# Checklist\n## _d_\n- a\n- b\n");
  });

  test("(12) duplicate parent heading: uses the first", () => {
    expect(
      appendUnderDateGroup(
        "# Checklist\n## _D_\n- a\n\n# Checklist\n- b\n",
        P,
        "_D_",
        "- c",
      ),
    ).toBe("# Checklist\n## _D_\n- a\n- c\n\n# Checklist\n- b\n");
  });

  test("(13) parent given, non-empty file without it: creates parent + group at end", () => {
    expect(appendUnderDateGroup("intro\n", P, "_D_", "- c")).toBe(
      "intro\n\n# Checklist\n## _D_\n- c\n",
    );
  });

  test("(14) parent given at H2: date group is created at H3", () => {
    expect(
      appendUnderDateGroup(
        "## Tasks\n- a\n",
        { level: 2, text: "Tasks" },
        "_D_",
        "- c",
      ),
    ).toBe("## Tasks\n- a\n\n### _D_\n- c\n");
  });
});
