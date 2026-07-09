import { describe, expect, test } from "vitest";
import { TEMPLATES } from "./templates";
import { buildTemplateVars, type TemplateVars } from "./vars";

// Fixed clock so {date}/{time} are deterministic: "Wed, 8 July 2026" / "14:30".
const NOW = new Date("2026-07-08T14:30:00");

function vars(
  over: Partial<Parameters<typeof buildTemplateVars>[0]> = {},
): TemplateVars {
  return buildTemplateVars({
    content: "buy milk",
    selected: "buy milk",
    clipboard: "",
    extra: "",
    url: "",
    title: "",
    app: "",
    project: "",
    now: NOW,
    dateFormat: "yyyy-MM-dd'T'HH:mm:ss",
    tags: [],
    ...over,
  });
}

// Branch fixtures reused across templates.
const BROWSER = {
  url: "https://example.com/a",
  title: "Great Article",
  app: "Safari",
};
const TERMINAL = { url: "", title: "", app: "Terminal" };
const EMPTY = { url: "", title: "", app: "" };

describe("TEMPLATES shape", () => {
  test("every default is a function returning a non-empty string", () => {
    for (const [key, fn] of Object.entries(TEMPLATES)) {
      expect(fn, key).toBeTypeOf("function");
      const out = fn(vars());
      expect(out, key).toBeTypeOf("string");
      expect(out.length, key).toBeGreaterThan(0);
    }
  });
});

describe("checklist default", () => {
  test("browser: time + colon, inline link + app, NO date in the line", () => {
    expect(TEMPLATES.checklist(vars(BROWSER))).toBe(
      "- [ ] **14:30**: buy milk [link](https://example.com/a) (Safari)",
    );
  });
  test("non-browser: app only, NO double space, NO empty ()", () => {
    expect(TEMPLATES.checklist(vars(TERMINAL))).toBe(
      "- [ ] **14:30**: buy milk (Terminal)",
    );
  });
  test("empty source: clean, no trailing punctuation", () => {
    expect(TEMPLATES.checklist(vars(EMPTY))).toBe("- [ ] **14:30**: buy milk");
  });
  test("project: an [!!info:] code-span prefix before the content", () => {
    expect(TEMPLATES.checklist(vars({ ...EMPTY, project: "Work" }))).toBe(
      "- [ ] **14:30**: `[!!info:Work]` buy milk",
    );
  });
  test("extra: rendered first, in backticks, joined by the merge separator", () => {
    expect(TEMPLATES.checklist(vars({ ...EMPTY, extra: "note" }))).toBe(
      "- [ ] **14:30**: `note`; buy milk",
    );
  });
  test("project + extra: prefix, then backticked extra, then content", () => {
    expect(
      TEMPLATES.checklist(vars({ ...EMPTY, project: "Work", extra: "note" })),
    ).toBe("- [ ] **14:30**: `[!!info:Work]` `note`; buy milk");
  });
  test("clipboard joins the body after the selection", () => {
    expect(
      TEMPLATES.checklist(
        vars({ ...EMPTY, selected: "sel", clipboard: "clip" }),
      ),
    ).toBe("- [ ] **14:30**: sel; clip");
  });
  test("multi-line content: continuations indented 4 spaces, app on last line", () => {
    expect(
      TEMPLATES.checklist(vars({ ...TERMINAL, selected: "line1\nline2" })),
    ).toBe("- [ ] **14:30**: line1\n    line2 (Terminal)");
  });
});

describe("appendNote default", () => {
  test("browser + extra: metadata lines, comment=extra, selection quoted in fence", () => {
    const out = TEMPLATES.appendNote(
      vars({ ...BROWSER, extra: "important", selected: "line one\nline two" }),
    );
    expect(out).toContain("From app: Safari\n");
    expect(out).toContain("Page: [Great Article](https://example.com/a)\n");
    expect(out).toContain("> [!comment]\n> important\n");
    expect(out).toContain("````text\nline one\nline two\n````");
    expect(out.endsWith("---\n\n")).toBe(true);
    expect(out).not.toContain("- -"); // the old broken-bullet artifact
  });
  test("no extra: callout falls back to ?", () => {
    const out = TEMPLATES.appendNote(
      vars({ ...TERMINAL, extra: "", selected: "quote" }),
    );
    expect(out).toContain("> [!comment]\n> ?\n");
  });
  test("empty source: no metadata, no broken bullet", () => {
    const out = TEMPLATES.appendNote(vars({ ...EMPTY, selected: "quote" }));
    expect(out.startsWith("- **Wed, 8 July 2026 14:30**\n")).toBe(true);
    expect(out).not.toContain("From app:");
    expect(out).not.toContain("Page:");
    expect(out).not.toContain("- -");
  });
  test("no selection/clipboard: body fence is omitted entirely", () => {
    const out = TEMPLATES.appendNote(
      vars({
        ...TERMINAL,
        extra: "just a thought",
        selected: "",
        clipboard: "",
      }),
    );
    expect(out).not.toContain("````");
  });
});

describe("task default", () => {
  test("body is the content verbatim", () => {
    expect(TEMPLATES.task(vars())).toBe("buy milk");
  });
});

describe("note / formCreate defaults", () => {
  test("content + page reference when page present", () => {
    const out = TEMPLATES.note(vars(BROWSER));
    expect(out).toBe(
      "buy milk\n\nPage: [Great Article](https://example.com/a)\n",
    );
  });
  test("formCreate matches note", () => {
    expect(TEMPLATES.formCreate(vars(BROWSER))).toBe(
      TEMPLATES.note(vars(BROWSER)),
    );
  });
});

describe("formAppend default", () => {
  test("footer has date+time only, NO app (dropped: Form may resolve app=Raycast)", () => {
    const out = TEMPLATES.formAppend(vars({ app: "Raycast" }));
    expect(out).toBe("buy milk\n\n_Wed, 8 July 2026 14:30_");
    expect(out).not.toContain("Raycast");
    expect(out).not.toContain("·");
  });
});
