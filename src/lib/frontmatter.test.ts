import { describe, expect, test } from "vitest";
import {
  buildFrontmatter,
  parseExtraFrontmatter,
  upsertUpdatedField,
} from "./frontmatter";

describe("buildFrontmatter", () => {
  const base = {
    extra: [
      { key: "type", value: "task" },
      { key: "task_status", value: "active" },
    ],
    created: "2026-07-05T14:32:09",
    title: "",
    project: "",
    tags: [] as string[],
    sourceUrl: "",
  };
  const mk = (o: Partial<typeof base>) => buildFrontmatter({ ...base, ...o });

  test("orders extra fields, then created, title, project, tags, source_url", () => {
    expect(
      mk({
        title: "Buy milk",
        project: "Work",
        tags: ["work", "home"],
        sourceUrl: "https://example.com",
      }),
    ).toBe(
      [
        "---",
        "type: task",
        "task_status: active",
        "created: 2026-07-05T14:32:09",
        'title: "Buy milk"',
        "project: Work",
        "tags: [work, home]",
        'source_url: "https://example.com"',
        "---",
      ].join("\n"),
    );
  });

  test("omits the title line when the title is empty", () => {
    expect(mk({})).not.toContain("title:");
  });

  test("omits the project line when the project is empty", () => {
    expect(mk({ title: "T" })).not.toContain("project:");
  });

  test("emits the project line when the project is non-empty", () => {
    expect(mk({ project: "Home" })).toContain("project: Home");
  });

  test("omits source_url when the url is empty", () => {
    expect(mk({ title: "T" })).not.toContain("source_url");
  });

  test("includes a quoted source_url when the url is non-empty", () => {
    expect(mk({ sourceUrl: "https://a.com/p?q=1" })).toContain(
      'source_url: "https://a.com/p?q=1"',
    );
  });

  test("renders each extra field value through yamlScalar", () => {
    expect(mk({ extra: [{ key: "note", value: "a: b" }] })).toContain(
      'note: "a: b"',
    );
  });

  test("emits no extra lines when the extra list is empty", () => {
    expect(mk({ extra: [] })).toBe(
      ["---", "created: 2026-07-05T14:32:09", "tags: []", "---"].join("\n"),
    );
  });

  test("leaves the created value unquoted", () => {
    expect(mk({})).toContain("created: 2026-07-05T14:32:09");
  });

  test("renders an empty tag list as []", () => {
    expect(mk({})).toContain("tags: []");
  });

  test("quotes a title that contains a colon", () => {
    expect(mk({ title: "Re: hello" })).toContain('title: "Re: hello"');
  });

  test("escapes double quotes inside a quoted title", () => {
    expect(mk({ title: 'say "hi"' })).toContain('title: "say \\"hi\\""');
  });

  test("keeps a simple word title unquoted", () => {
    expect(mk({ title: "Todo" })).toContain("title: Todo");
  });

  test("quotes a numeric-looking title so YAML keeps it a string", () => {
    expect(mk({ title: "2026" })).toContain('title: "2026"');
  });

  test("quotes a YAML boolean keyword in the title", () => {
    expect(mk({ title: "true" })).toContain('title: "true"');
  });

  test("quotes a tag that contains a space inside the flow list", () => {
    expect(mk({ tags: ["my tag", "home"] })).toContain(
      'tags: ["my tag", home]',
    );
  });

  test("quotes a project value that contains a space", () => {
    expect(mk({ project: "Big Client" })).toContain('project: "Big Client"');
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

describe("parseExtraFrontmatter", () => {
  test("returns an empty list for an empty or whitespace preference", () => {
    expect(parseExtraFrontmatter("")).toEqual([]);
    expect(parseExtraFrontmatter("   ")).toEqual([]);
  });

  test("parses semicolon-separated key/value pairs, in order", () => {
    expect(parseExtraFrontmatter("type: task; task_status: active")).toEqual([
      { key: "type", value: "task" },
      { key: "task_status", value: "active" },
    ]);
  });

  test("drops empty segments from stray or trailing semicolons", () => {
    expect(parseExtraFrontmatter("type: task;; ; ")).toEqual([
      { key: "type", value: "task" },
    ]);
  });

  test("splits only on the first colon so values may contain colons", () => {
    expect(parseExtraFrontmatter("ref: see http://x")).toEqual([
      { key: "ref", value: "see http://x" },
    ]);
  });

  test("throws on a segment without a colon", () => {
    expect(() => parseExtraFrontmatter("type task")).toThrow();
  });

  test("throws on an empty key", () => {
    expect(() => parseExtraFrontmatter(": value")).toThrow();
  });

  test("throws on a reserved structural key, case-insensitively", () => {
    expect(() => parseExtraFrontmatter("title: x")).toThrow();
    expect(() => parseExtraFrontmatter("Created: x")).toThrow();
    expect(() => parseExtraFrontmatter("source_url: x")).toThrow();
    expect(() => parseExtraFrontmatter("project: x")).toThrow();
  });

  test("throws on a duplicate key, case-insensitively", () => {
    expect(() => parseExtraFrontmatter("type: a; TYPE: b")).toThrow();
  });
});
