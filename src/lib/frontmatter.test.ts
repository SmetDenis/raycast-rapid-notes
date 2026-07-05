import { describe, expect, test } from "vitest";
import { buildFrontmatter, upsertUpdatedField } from "./frontmatter";

describe("buildFrontmatter", () => {
  test("builds a full block with title, source_url and the fixed type/status", () => {
    expect(
      buildFrontmatter({
        created: "2026-07-05T14:32:09",
        tags: ["work", "home"],
        title: "Buy milk",
        sourceUrl: "https://example.com",
      }),
    ).toBe(
      [
        "---",
        "created: 2026-07-05T14:32:09",
        "tags: [work, home]",
        'title: "Buy milk"',
        'source_url: "https://example.com"',
        "type: task",
        "task_status: active",
        "---",
      ].join("\n"),
    );
  });

  test("omits the title line when the title is empty", () => {
    expect(
      buildFrontmatter({ created: "x", tags: [], title: "", sourceUrl: "" }),
    ).toBe(
      [
        "---",
        "created: x",
        "tags: []",
        "type: task",
        "task_status: active",
        "---",
      ].join("\n"),
    );
  });

  test("omits source_url when the url is empty", () => {
    const out = buildFrontmatter({
      created: "x",
      tags: [],
      title: "T",
      sourceUrl: "",
    });
    expect(out).not.toContain("source_url");
    expect(out).toContain("title: T");
  });

  test("includes a quoted source_url when the url is non-empty", () => {
    expect(
      buildFrontmatter({
        created: "x",
        tags: [],
        title: "T",
        sourceUrl: "https://a.com/p?q=1",
      }),
    ).toContain('source_url: "https://a.com/p?q=1"');
  });

  test("leaves the created value unquoted", () => {
    expect(
      buildFrontmatter({
        created: "2026-07-05T14:32:09",
        tags: [],
        title: "T",
        sourceUrl: "",
      }),
    ).toContain("created: 2026-07-05T14:32:09");
  });

  test("renders an empty tag list as []", () => {
    expect(
      buildFrontmatter({ created: "x", tags: [], title: "T", sourceUrl: "" }),
    ).toContain("tags: []");
  });

  test("adds fixed type and task_status fields", () => {
    const out = buildFrontmatter({
      created: "x",
      tags: [],
      title: "T",
      sourceUrl: "",
    });
    expect(out).toContain("type: task");
    expect(out).toContain("task_status: active");
  });

  test("quotes a title that contains a colon", () => {
    expect(
      buildFrontmatter({
        created: "x",
        tags: [],
        title: "Re: hello",
        sourceUrl: "",
      }),
    ).toContain('title: "Re: hello"');
  });

  test("escapes double quotes inside a quoted title", () => {
    expect(
      buildFrontmatter({
        created: "x",
        tags: [],
        title: 'say "hi"',
        sourceUrl: "",
      }),
    ).toContain('title: "say \\"hi\\""');
  });

  test("keeps a simple word title unquoted", () => {
    expect(
      buildFrontmatter({
        created: "x",
        tags: [],
        title: "Todo",
        sourceUrl: "",
      }),
    ).toContain("title: Todo");
  });

  test("quotes a tag that contains a space inside the flow list", () => {
    expect(
      buildFrontmatter({
        created: "x",
        tags: ["my tag", "home"],
        title: "n",
        sourceUrl: "",
      }),
    ).toContain('tags: ["my tag", home]');
  });

  test("quotes a numeric-looking title so YAML keeps it a string", () => {
    expect(
      buildFrontmatter({
        created: "x",
        tags: [],
        title: "2026",
        sourceUrl: "",
      }),
    ).toContain('title: "2026"');
  });

  test("quotes a YAML boolean keyword in the title", () => {
    expect(
      buildFrontmatter({
        created: "x",
        tags: [],
        title: "true",
        sourceUrl: "",
      }),
    ).toContain('title: "true"');
  });

  test("quotes a YAML null keyword used as a tag", () => {
    expect(
      buildFrontmatter({
        created: "x",
        tags: ["null"],
        title: "n",
        sourceUrl: "",
      }),
    ).toContain('tags: ["null"]');
  });
});

describe("upsertUpdatedField", () => {
  test("inserts updated right after created when absent", () => {
    const input = "---\ncreated: 2026-01-01T00:00:00\ntags: []\n---\n\nbody\n";
    expect(upsertUpdatedField(input, "2026-07-05T14:32:09")).toBe(
      "---\ncreated: 2026-01-01T00:00:00\nupdated: 2026-07-05T14:32:09\ntags: []\n---\n\nbody\n",
    );
  });

  test("replaces an existing updated value in place", () => {
    const input = "---\ncreated: c\nupdated: old\ntags: []\n---\n\nb\n";
    expect(upsertUpdatedField(input, "NEW")).toBe(
      "---\ncreated: c\nupdated: NEW\ntags: []\n---\n\nb\n",
    );
  });

  test("appends updated at the end of frontmatter when there is no created", () => {
    const input = "---\ntitle: T\n---\n\nb\n";
    expect(upsertUpdatedField(input, "NOW")).toBe(
      "---\ntitle: T\nupdated: NOW\n---\n\nb\n",
    );
  });

  test("leaves content without frontmatter unchanged", () => {
    const input = "- [ ] a\n- [ ] b\n";
    expect(upsertUpdatedField(input, "NOW")).toBe(input);
  });

  test("leaves content with an unterminated frontmatter unchanged", () => {
    const input = "---\ncreated: c\n\nbody with no closing fence\n";
    expect(upsertUpdatedField(input, "NOW")).toBe(input);
  });

  test("does not match keys that merely start with updated", () => {
    const input = "---\nupdated_by: me\n---\nx\n";
    expect(upsertUpdatedField(input, "NOW")).toBe(
      "---\nupdated_by: me\nupdated: NOW\n---\nx\n",
    );
  });
});
