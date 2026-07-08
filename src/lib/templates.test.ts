import { describe, expect, test } from "vitest";
import { DEFAULT_TEMPLATES, renderTemplateOrDefault } from "./templates";
import { buildTemplateVars } from "./vars";
import type { TemplateVars } from "./template";

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

describe("DEFAULT_TEMPLATES shape", () => {
  test("every default is a function returning a non-empty string", () => {
    for (const [key, fn] of Object.entries(DEFAULT_TEMPLATES)) {
      expect(fn, key).toBeTypeOf("function");
      const out = fn(vars());
      expect(out, key).toBeTypeOf("string");
      expect(out.length, key).toBeGreaterThan(0);
    }
  });
});

describe("checklist default", () => {
  test("browser: inline link + app, single spaces", () => {
    expect(DEFAULT_TEMPLATES.checklist(vars(BROWSER))).toBe(
      "- [ ] **Wed, 8 July 2026 14:30** buy milk [link](https://example.com/a) (Safari)",
    );
  });
  test("non-browser: app only, NO double space, NO empty ()", () => {
    expect(DEFAULT_TEMPLATES.checklist(vars(TERMINAL))).toBe(
      "- [ ] **Wed, 8 July 2026 14:30** buy milk (Terminal)",
    );
  });
  test("empty source: clean, no trailing punctuation", () => {
    expect(DEFAULT_TEMPLATES.checklist(vars(EMPTY))).toBe(
      "- [ ] **Wed, 8 July 2026 14:30** buy milk",
    );
  });
});

describe("appendNote default", () => {
  test("browser + extra: metadata lines, comment=extra, selection quoted in fence", () => {
    const out = DEFAULT_TEMPLATES.appendNote(
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
    const out = DEFAULT_TEMPLATES.appendNote(
      vars({ ...TERMINAL, extra: "", selected: "quote" }),
    );
    expect(out).toContain("> [!comment]\n> ?\n");
  });
  test("empty source: no metadata, no broken bullet", () => {
    const out = DEFAULT_TEMPLATES.appendNote(
      vars({ ...EMPTY, selected: "quote" }),
    );
    expect(out.startsWith("- **Wed, 8 July 2026 14:30**\n")).toBe(true);
    expect(out).not.toContain("From app:");
    expect(out).not.toContain("Page:");
    expect(out).not.toContain("- -");
  });
  test("no selection/clipboard: body fence is omitted entirely", () => {
    const out = DEFAULT_TEMPLATES.appendNote(
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
    expect(DEFAULT_TEMPLATES.task(vars())).toBe("buy milk");
  });
});

describe("note / formCreate defaults", () => {
  test("content + page reference when page present", () => {
    const out = DEFAULT_TEMPLATES.note(vars(BROWSER));
    expect(out).toBe(
      "buy milk\n\nPage: [Great Article](https://example.com/a)\n",
    );
  });
  test("formCreate matches note", () => {
    expect(DEFAULT_TEMPLATES.formCreate(vars(BROWSER))).toBe(
      DEFAULT_TEMPLATES.note(vars(BROWSER)),
    );
  });
});

describe("formAppend default", () => {
  test("footer has date+time only, NO app (dropped: Form may resolve app=Raycast)", () => {
    const out = DEFAULT_TEMPLATES.formAppend(vars({ app: "Raycast" }));
    expect(out).toBe("buy milk\n\n_Wed, 8 July 2026 14:30_");
    expect(out).not.toContain("Raycast");
    expect(out).not.toContain("·");
  });
});

describe("renderTemplateOrDefault", () => {
  test("non-empty pref is rendered as a string template", () => {
    expect(
      renderTemplateOrDefault(
        "custom {content}!",
        DEFAULT_TEMPLATES.task,
        vars(),
      ),
    ).toBe("custom buy milk!");
  });
  test("undefined / empty / whitespace pref falls back to the default function", () => {
    expect(
      renderTemplateOrDefault(undefined, DEFAULT_TEMPLATES.task, vars()),
    ).toBe("buy milk");
    expect(renderTemplateOrDefault("", DEFAULT_TEMPLATES.task, vars())).toBe(
      "buy milk",
    );
    expect(
      renderTemplateOrDefault("  \n\t ", DEFAULT_TEMPLATES.task, vars()),
    ).toBe("buy milk");
  });
  test("pref path interprets backslash escapes; default path uses real newlines", () => {
    expect(
      renderTemplateOrDefault("a\\nb", DEFAULT_TEMPLATES.task, vars()),
    ).toBe("a\nb");
  });
});
