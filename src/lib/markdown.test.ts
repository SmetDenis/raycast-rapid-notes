import { describe, expect, test } from "vitest";
import {
  indentContinuation,
  prependToTop,
  prependUnderDateGroup,
  prependUnderHeading,
} from "./markdown";

describe("prependToTop", () => {
  test("writes the line to an empty file", () => {
    expect(prependToTop("", "- x")).toBe("- x\n");
  });

  test("prepends before content that ends with a newline", () => {
    expect(prependToTop("a\n", "- x")).toBe("- x\na\n");
  });

  test("adds a missing trailing newline after prepending", () => {
    expect(prependToTop("a", "- x")).toBe("- x\na\n");
  });

  test("inserts below a YAML frontmatter block", () => {
    expect(prependToTop("---\ncreated: x\n---\nbody\n", "- x")).toBe(
      "---\ncreated: x\n---\n- x\nbody\n",
    );
  });

  test("inserts below frontmatter in a frontmatter-only file", () => {
    expect(prependToTop("---\ncreated: x\n---\n", "- x")).toBe(
      "---\ncreated: x\n---\n- x\n",
    );
  });

  test("keeps a multi-line block intact below frontmatter", () => {
    expect(prependToTop("---\nc: 1\n---\nold\n", "new\n\n_ts_")).toBe(
      "---\nc: 1\n---\nnew\n\n_ts_\nold\n",
    );
  });

  test("treats an unclosed frontmatter as no frontmatter (inserts at the very top)", () => {
    expect(prependToTop("---\nno close\n", "- x")).toBe("- x\n---\nno close\n");
  });
});

describe("prependUnderHeading", () => {
  test("inserts at the top of the section, right after the heading", () => {
    const input = "# Inbox\n- a\n\n# Done\n- b\n";
    expect(prependUnderHeading(input, 1, "Inbox", "- c")).toBe(
      "# Inbox\n- c\n- a\n\n# Done\n- b\n",
    );
  });

  test("inserts after the heading in a section that runs to EOF", () => {
    expect(prependUnderHeading("# Inbox\n- a\n", 1, "Inbox", "- c")).toBe(
      "# Inbox\n- c\n- a\n",
    );
  });

  test("inserts into an empty heading section", () => {
    expect(prependUnderHeading("# Inbox\n# Done\n", 1, "Inbox", "- c")).toBe(
      "# Inbox\n- c\n# Done\n",
    );
  });

  test("creates the section at the end when the heading is missing", () => {
    expect(prependUnderHeading("# Other\n- a\n", 1, "Inbox", "- c")).toBe(
      "# Other\n- a\n\n# Inbox\n- c\n",
    );
  });

  test("creates the heading in an empty file", () => {
    expect(prependUnderHeading("", 1, "Inbox", "- c")).toBe("# Inbox\n- c\n");
  });

  test("matches the level exactly, not an H2 with the same text", () => {
    expect(prependUnderHeading("## Inbox\n- a\n", 1, "Inbox", "- c")).toBe(
      "## Inbox\n- a\n\n# Inbox\n- c\n",
    );
  });

  test("adds a missing trailing newline when inserting after the heading", () => {
    expect(prependUnderHeading("# Inbox\n- a", 1, "Inbox", "- c")).toBe(
      "# Inbox\n- c\n- a\n",
    );
  });

  test("matches an exact H2 heading and inserts inside it", () => {
    expect(prependUnderHeading("## Tasks\n- a\n", 2, "Tasks", "- c")).toBe(
      "## Tasks\n- c\n- a\n",
    );
  });

  test("matches case-insensitively, keeping the file's original case", () => {
    expect(prependUnderHeading("## tasks\n- a\n", 2, "Tasks", "- c")).toBe(
      "## tasks\n- c\n- a\n",
    );
  });

  test("inserts after the heading even when a nested sub-heading follows", () => {
    expect(
      prependUnderHeading("## Tasks\n- a\n### Sub\n- b\n", 2, "Tasks", "- c"),
    ).toBe("## Tasks\n- c\n- a\n### Sub\n- b\n");
  });

  test("matches markdown heading text case-insensitively", () => {
    expect(
      prependUnderHeading("## **Title**\n- a\n", 2, "**title**", "- c"),
    ).toBe("## **Title**\n- c\n- a\n");
  });

  test("creates a missing heading at the configured level", () => {
    expect(prependUnderHeading("# Other\n- a\n", 3, "Notes", "- c")).toBe(
      "# Other\n- a\n\n### Notes\n- c\n",
    );
  });

  test("inserts after the heading regardless of a nested sub-heading below", () => {
    expect(
      prependUnderHeading(
        "# Inbox\n- a\n## Sub\n- b\n# Done\n",
        1,
        "Inbox",
        "- c",
      ),
    ).toBe("# Inbox\n- c\n- a\n## Sub\n- b\n# Done\n");
  });

  test("inserts below frontmatter when the heading sits under it", () => {
    expect(
      prependUnderHeading(
        "---\ncreated: x\n---\n# Notes\n- a\n",
        1,
        "Notes",
        "- c",
      ),
    ).toBe("---\ncreated: x\n---\n# Notes\n- c\n- a\n");
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

describe("prependUnderDateGroup", () => {
  const P = { level: 1, text: "Checklist" };

  test("(1) parent exists, no groups yet: creates the group in the parent section", () => {
    expect(prependUnderDateGroup("# Checklist\n", P, "_D_", "- c")).toBe(
      "# Checklist\n## _D_\n- c\n",
    );
  });

  test("(2) group is the only one: item goes to the top of the group", () => {
    expect(
      prependUnderDateGroup("# Checklist\n## _D_\n- a\n", P, "_D_", "- b"),
    ).toBe("# Checklist\n## _D_\n- b\n- a\n");
  });

  test("(3) group is not last: item prepended inside it, order preserved", () => {
    expect(
      prependUnderDateGroup(
        "# Checklist\n## _D1_\n- a\n\n## _D2_\n- b\n",
        P,
        "_D1_",
        "- c",
      ),
    ).toBe("# Checklist\n## _D1_\n- c\n- a\n\n## _D2_\n- b\n");
  });

  test("(4) new group goes to the TOP of the parent section, before older groups", () => {
    expect(
      prependUnderDateGroup(
        "# Checklist\n## _D_\n- a\n\n# Archive\n- z\n",
        P,
        "_E_",
        "- c",
      ),
    ).toBe("# Checklist\n## _E_\n- c\n\n## _D_\n- a\n\n# Archive\n- z\n");
  });

  test("(5) parent is null, non-empty file: creates an H1 date group at the top", () => {
    expect(prependUnderDateGroup("some text\n", null, "_D_", "- c")).toBe(
      "# _D_\n- c\n\nsome text\n",
    );
  });

  test("(6) empty file + parent: creates parent and group", () => {
    expect(prependUnderDateGroup("", P, "_D_", "- c")).toBe(
      "# Checklist\n## _D_\n- c\n",
    );
  });

  test("(7) duplicate date groups: prepends to the first", () => {
    expect(
      prependUnderDateGroup(
        "# Checklist\n## _D_\n- a\n\n## _D_\n- b\n",
        P,
        "_D_",
        "- c",
      ),
    ).toBe("# Checklist\n## _D_\n- c\n- a\n\n## _D_\n- b\n");
  });

  test("(8) multi-line line is inserted verbatim at the top of the group", () => {
    expect(
      prependUnderDateGroup(
        "# Checklist\n## _D_\n- a\n",
        P,
        "_D_",
        "- b\n    cont",
      ),
    ).toBe("# Checklist\n## _D_\n- b\n    cont\n- a\n");
  });

  test("(9) parent is null, empty file: creates an H1 date group", () => {
    expect(prependUnderDateGroup("", null, "_D_", "- c")).toBe("# _D_\n- c\n");
  });

  test("(10) group has multi-line items: new item lands at the top, above them", () => {
    expect(
      prependUnderDateGroup(
        "# Checklist\n## _D_\n- a\n    cont\n",
        P,
        "_D_",
        "- b",
      ),
    ).toBe("# Checklist\n## _D_\n- b\n- a\n    cont\n");
  });

  test("(11) matches the group text case-insensitively, keeping file case", () => {
    expect(
      prependUnderDateGroup("# Checklist\n## _d_\n- a\n", P, "_D_", "- b"),
    ).toBe("# Checklist\n## _d_\n- b\n- a\n");
  });

  test("(12) duplicate parent heading: uses the first", () => {
    expect(
      prependUnderDateGroup(
        "# Checklist\n## _D_\n- a\n\n# Checklist\n- b\n",
        P,
        "_D_",
        "- c",
      ),
    ).toBe("# Checklist\n## _D_\n- c\n- a\n\n# Checklist\n- b\n");
  });

  test("(13) parent given, non-empty file without it: creates parent + group at end", () => {
    expect(prependUnderDateGroup("intro\n", P, "_D_", "- c")).toBe(
      "intro\n\n# Checklist\n## _D_\n- c\n",
    );
  });

  test("(14) parent given at H2, group missing: date group is created at H3, at the section top", () => {
    expect(
      prependUnderDateGroup(
        "## Tasks\n- a\n",
        { level: 2, text: "Tasks" },
        "_D_",
        "- c",
      ),
    ).toBe("## Tasks\n### _D_\n- c\n\n- a\n");
  });

  test("(15) parent null, group found: prepends the item to the group", () => {
    expect(prependUnderDateGroup("# _D_\n- a\n", null, "_D_", "- b")).toBe(
      "# _D_\n- b\n- a\n",
    );
  });

  test("(16) parent null, new day goes above the older day", () => {
    expect(prependUnderDateGroup("# _D1_\n- a\n", null, "_D2_", "- b")).toBe(
      "# _D2_\n- b\n\n# _D1_\n- a\n",
    );
  });

  test("(17) parent null, creates the group below frontmatter", () => {
    expect(
      prependUnderDateGroup(
        "---\ncreated: x\n---\n# _D1_\n- a\n",
        null,
        "_D2_",
        "- b",
      ),
    ).toBe("---\ncreated: x\n---\n# _D2_\n- b\n\n# _D1_\n- a\n");
  });
});
