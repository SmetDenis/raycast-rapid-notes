import { describe, expect, test } from "vitest";
import { applyAppend, buildNewNote } from "./note";

describe("applyAppend", () => {
  test("appends to the end when the heading is empty", () => {
    expect(applyAppend("a\n", "", "- x")).toBe("a\n- x\n");
  });

  test("treats a whitespace-only heading as empty", () => {
    expect(applyAppend("a\n", "   ", "- x")).toBe("a\n- x\n");
  });

  test("appends under the heading when one is given", () => {
    expect(applyAppend("# Inbox\n- a\n", "Inbox", "- x")).toBe(
      "# Inbox\n- a\n- x\n",
    );
  });

  test("parses an explicit level from the preference", () => {
    expect(applyAppend("## Tasks\n- a\n", "## Tasks", "- x")).toBe(
      "## Tasks\n- a\n- x\n",
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
      "### notes\n- a\n- x\n",
    );
  });
});

describe("buildNewNote", () => {
  // Frontmatter block for a titled note without a source_url.
  const fm = (created: string, tags: string, title: string) =>
    `---\ncreated: ${created}\ntags: ${tags}\ntitle: ${title}\ntype: task\ntask_status: active\n---`;

  test("composes frontmatter, the body on the next line, and a trailing newline", () => {
    expect(
      buildNewNote({
        created: "2026-07-05T14:32:09",
        tags: ["work"],
        title: "T",
        sourceUrl: "",
        body: "hello",
      }),
    ).toBe(`${fm("2026-07-05T14:32:09", "[work]", "T")}\nhello\n`);
  });

  test("omits the body block when the body is empty", () => {
    expect(
      buildNewNote({
        created: "x",
        tags: [],
        title: "T",
        sourceUrl: "",
        body: "",
      }),
    ).toBe(`${fm("x", "[]", "T")}\n`);
  });

  test("preserves intentional trailing newlines in the body", () => {
    expect(
      buildNewNote({
        created: "x",
        tags: [],
        title: "T",
        sourceUrl: "",
        body: "hello\n\n",
      }),
    ).toBe(`${fm("x", "[]", "T")}\nhello\n\n`);
  });

  test("preserves internal blank lines in the body", () => {
    expect(
      buildNewNote({
        created: "x",
        tags: [],
        title: "T",
        sourceUrl: "",
        body: "a\n\nb",
      }),
    ).toBe(`${fm("x", "[]", "T")}\na\n\nb\n`);
  });

  test("treats a whitespace-only body as empty", () => {
    expect(
      buildNewNote({
        created: "x",
        tags: [],
        title: "T",
        sourceUrl: "",
        body: "  \n",
      }),
    ).toBe(`${fm("x", "[]", "T")}\n`);
  });

  test("includes source_url in the frontmatter when provided", () => {
    expect(
      buildNewNote({
        created: "x",
        tags: [],
        title: "T",
        sourceUrl: "https://a.com",
        body: "b",
      }),
    ).toContain('source_url: "https://a.com"');
  });
});
