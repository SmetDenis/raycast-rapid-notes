import { describe, expect, test } from "vitest";
import { chooseAppendFormat } from "./route";

describe("chooseAppendFormat", () => {
  test("single line is a checklist item", () => {
    expect(chooseAppendFormat("buy milk")).toBe("checklist");
  });
  test("an internal newline makes it a note", () => {
    expect(chooseAppendFormat("line one\nline two")).toBe("note");
  });
  test("a trailing newline alone does NOT make a note (trimmed first)", () => {
    expect(chooseAppendFormat("buy milk\n")).toBe("checklist");
  });
  test("surrounding blank lines are trimmed before deciding", () => {
    expect(chooseAppendFormat("\n\nbuy milk\n\n")).toBe("checklist");
  });
  test("empty/whitespace content is a checklist (don't-care; guarded upstream)", () => {
    expect(chooseAppendFormat("")).toBe("checklist");
    expect(chooseAppendFormat("   ")).toBe("checklist");
  });
});
