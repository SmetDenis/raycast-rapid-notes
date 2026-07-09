import { describe, expect, test } from "vitest";
import {
  applyAppend,
  applyGroupedAppend,
  buildCreateFile,
  buildNewNote,
  composeCreateTitle,
  isEmptyCapture,
} from "./note";

describe("applyAppend", () => {
  test("prepends to the top when the heading is empty", () => {
    expect(applyAppend("a\n", "", "- x")).toBe("- x\na\n");
  });

  test("treats a whitespace-only heading as empty", () => {
    expect(applyAppend("a\n", "   ", "- x")).toBe("- x\na\n");
  });

  test("prepends under the heading when one is given", () => {
    expect(applyAppend("# Inbox\n- a\n", "Inbox", "- x")).toBe(
      "# Inbox\n- x\n- a\n",
    );
  });

  test("parses an explicit level from the preference", () => {
    expect(applyAppend("## Tasks\n- a\n", "## Tasks", "- x")).toBe(
      "## Tasks\n- x\n- a\n",
    );
  });

  test("creates a heading at the parsed level when absent", () => {
    expect(applyAppend("", "### Notes", "- x")).toBe("### Notes\n- x\n");
  });

  test("keeps markdown in the heading text", () => {
    expect(applyAppend("", "## **title**", "- x")).toBe("## **title**\n- x\n");
  });

  test("matches the heading case-insensitively", () => {
    expect(applyAppend("### notes\n- a\n", "### Notes", "- x")).toBe(
      "### notes\n- x\n- a\n",
    );
  });
});

describe("applyGroupedAppend", () => {
  test("creates the date group under the configured heading", () => {
    expect(
      applyGroupedAppend("# Checklist\n", "# Checklist", "_D_", "- c"),
    ).toBe("# Checklist\n## _D_\n- c\n");
  });

  test("prepends inside an existing date group", () => {
    expect(
      applyGroupedAppend(
        "# Checklist\n## _D_\n- a\n",
        "# Checklist",
        "_D_",
        "- b",
      ),
    ).toBe("# Checklist\n## _D_\n- b\n- a\n");
  });

  test("groups at the top level when the heading pref is empty", () => {
    expect(applyGroupedAppend("intro\n", "", "_D_", "- c")).toBe(
      "# _D_\n- c\n\nintro\n",
    );
  });
});

describe("buildNewNote", () => {
  const extra = [
    { key: "type", value: "task" },
    { key: "task_status", value: "active" },
  ];
  const base = {
    extra,
    created: "x",
    title: "T",
    project: "",
    tags: [] as string[],
    sourceUrl: "",
    body: "",
  };
  const mk = (o: Partial<typeof base>) => buildNewNote({ ...base, ...o });

  // Frontmatter block for a titled note without project/source_url (new field order).
  const fm = (created: string, tags: string, title: string) =>
    `---\ntype: task\ntask_status: active\ncreated: ${created}\ntitle: ${title}\ntags: ${tags}\n---`;

  test("composes frontmatter, the body on the next line, and a trailing newline", () => {
    expect(
      mk({ created: "2026-07-05T14:32:09", tags: ["work"], body: "hello" }),
    ).toBe(`${fm("2026-07-05T14:32:09", "[work]", "T")}\nhello\n`);
  });

  test("omits the body block when the body is empty", () => {
    expect(mk({})).toBe(`${fm("x", "[]", "T")}\n`);
  });

  test("preserves intentional trailing newlines in the body", () => {
    expect(mk({ body: "hello\n\n" })).toBe(`${fm("x", "[]", "T")}\nhello\n\n`);
  });

  test("preserves internal blank lines in the body", () => {
    expect(mk({ body: "a\n\nb" })).toBe(`${fm("x", "[]", "T")}\na\n\nb\n`);
  });

  test("treats a whitespace-only body as empty", () => {
    expect(mk({ body: "  \n" })).toBe(`${fm("x", "[]", "T")}\n`);
  });

  test("includes source_url in the frontmatter when provided", () => {
    expect(mk({ sourceUrl: "https://a.com", body: "b" })).toContain(
      'source_url: "https://a.com"',
    );
  });

  test("includes the project field when provided", () => {
    expect(mk({ project: "Work", body: "b" })).toContain("project: Work");
  });
});

describe("composeCreateTitle", () => {
  const fallback = "Sat, 6 July 2026 14:30";
  const mk = (project: string, title: string) =>
    composeCreateTitle({ project, title, dateFallback: fallback });

  test("prefixes the project when both project and title are present", () => {
    expect(mk("Work", "Fix login")).toBe("Work: Fix login");
  });

  test("falls back to the date/time when the title is empty", () => {
    expect(mk("Work", "")).toBe(`Work: ${fallback}`);
  });

  test("uses the bare title when no project is given", () => {
    expect(mk("", "Fix login")).toBe("Fix login");
  });

  test("falls back to date/time with no project and no title", () => {
    expect(mk("", "")).toBe(fallback);
  });

  test("trims the project and the title", () => {
    expect(mk("  Work  ", "  Fix  ")).toBe("Work: Fix");
  });
});

describe("isEmptyCapture", () => {
  const mk = (
    o: Partial<{ content: string; title: string; project: string }>,
  ) => isEmptyCapture({ content: "", title: "", project: "", ...o });

  test("is empty when content, title and project are all blank", () => {
    expect(mk({})).toBe(true);
    expect(mk({ content: "  ", title: " \t", project: "\n" })).toBe(true);
  });

  test("is not empty when content is present", () => {
    expect(mk({ content: "hi" })).toBe(false);
  });

  test("is not empty when only a title is present (title-only is valid)", () => {
    expect(mk({ title: "T" })).toBe(false);
  });

  test("is not empty when only a project is present", () => {
    expect(mk({ project: "Work" })).toBe(false);
  });
});

describe("buildCreateFile", () => {
  const base = {
    frontmatterPref: "type: task; task_status: active",
    created: "2026-07-05T14:32:09",
    title: "",
    project: "",
    dateFallback: "Sun, 5 July 2026 14:32",
    tags: [] as string[],
    sourceUrl: "",
    body: "",
  };
  const mk = (o: Partial<typeof base>) => buildCreateFile({ ...base, ...o });

  test("emits parsed extra fields, the composed title, project and body", () => {
    const out = mk({ title: "Ship it", project: "Work", body: "do the thing" });
    expect(out).toContain("type: task");
    expect(out).toContain("task_status: active");
    expect(out).toContain('title: "Work: Ship it"');
    expect(out).toContain("project: Work");
    expect(out.endsWith("do the thing\n")).toBe(true);
  });

  test("falls back to the date/time title when no title is given", () => {
    expect(mk({ body: "x" })).toContain('title: "Sun, 5 July 2026 14:32"');
  });

  test("propagates a parse error from a malformed frontmatter pref", () => {
    expect(() => mk({ frontmatterPref: "title: nope" })).toThrow();
  });

  test("includes source_url when provided", () => {
    expect(mk({ sourceUrl: "https://a.com", body: "b" })).toContain(
      'source_url: "https://a.com"',
    );
  });
});
