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
});

describe("buildNewNote", () => {
  test("composes frontmatter, a blank line, the body, and a trailing newline", () => {
    expect(
      buildNewNote({
        created: "2026-07-05T14:32:09",
        tags: ["work"],
        title: "T",
        body: "hello",
      }),
    ).toBe(
      "---\ncreated: 2026-07-05T14:32:09\ntags: [work]\ntitle: T\n---\n\nhello\n",
    );
  });

  test("omits the body block when the body is empty", () => {
    expect(buildNewNote({ created: "x", tags: [], title: "T", body: "" })).toBe(
      "---\ncreated: x\ntags: []\ntitle: T\n---\n",
    );
  });
});
