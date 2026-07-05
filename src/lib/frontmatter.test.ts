import { describe, expect, test } from "vitest";
import { buildFrontmatter } from "./frontmatter";

describe("buildFrontmatter", () => {
  test("builds a block with created, tags and title in a fixed order", () => {
    expect(
      buildFrontmatter({
        created: "2026-07-05T14:32:09",
        tags: ["work", "home"],
        title: "Buy milk",
      }),
    ).toBe(
      [
        "---",
        "created: 2026-07-05T14:32:09",
        "tags: [work, home]",
        'title: "Buy milk"',
        "---",
      ].join("\n"),
    );
  });

  test("renders an empty tag list as []", () => {
    expect(
      buildFrontmatter({
        created: "2026-07-05T14:32:09",
        tags: [],
        title: "Note",
      }),
    ).toBe(
      [
        "---",
        "created: 2026-07-05T14:32:09",
        "tags: []",
        "title: Note",
        "---",
      ].join("\n"),
    );
  });

  test("leaves the created value unquoted", () => {
    const out = buildFrontmatter({
      created: "2026-07-05T14:32:09",
      tags: [],
      title: "Note",
    });
    expect(out).toContain("created: 2026-07-05T14:32:09");
  });

  test("quotes a title that contains a colon", () => {
    const out = buildFrontmatter({
      created: "x",
      tags: [],
      title: "Re: hello",
    });
    expect(out).toContain('title: "Re: hello"');
  });

  test("escapes double quotes inside a quoted title", () => {
    const out = buildFrontmatter({ created: "x", tags: [], title: 'say "hi"' });
    expect(out).toContain('title: "say \\"hi\\""');
  });

  test("quotes an empty title as an empty string", () => {
    const out = buildFrontmatter({ created: "x", tags: [], title: "" });
    expect(out).toContain('title: ""');
  });

  test("keeps a simple word title unquoted", () => {
    const out = buildFrontmatter({ created: "x", tags: [], title: "Todo" });
    expect(out).toContain("title: Todo");
  });

  test("quotes a tag that contains a space inside the flow list", () => {
    const out = buildFrontmatter({
      created: "x",
      tags: ["my tag", "home"],
      title: "n",
    });
    expect(out).toContain('tags: ["my tag", home]');
  });

  test("quotes a numeric-looking title so YAML keeps it a string", () => {
    expect(
      buildFrontmatter({ created: "x", tags: [], title: "2026" }),
    ).toContain('title: "2026"');
  });

  test("quotes a decimal-looking title", () => {
    expect(
      buildFrontmatter({ created: "x", tags: [], title: "1.5" }),
    ).toContain('title: "1.5"');
  });

  test("quotes a YAML boolean keyword in the title", () => {
    expect(
      buildFrontmatter({ created: "x", tags: [], title: "true" }),
    ).toContain('title: "true"');
  });

  test("quotes a YAML null keyword used as a tag", () => {
    expect(
      buildFrontmatter({ created: "x", tags: ["null"], title: "n" }),
    ).toContain('tags: ["null"]');
  });
});
