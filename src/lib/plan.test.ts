import { describe, expect, test } from "vitest";
import type { CaptureInputs } from "./capture-inputs";
import {
  planFormAppend,
  planFormCreate,
  planSilentAppend,
  planSilentCreate,
  type CaptureSource,
} from "./plan";
import { TEMPLATES } from "./templates";

// Fixed clock so {date}/{time}/{datetime} are deterministic: "Wed, 8 July 2026" / "14:30".
const NOW = new Date("2026-07-08T14:30:00");
const DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
const GROUP = "_Wed, 8 July 2026_";
const UPDATED = "2026-07-08T14:30:00";

const CONFIG = {
  note: { file: "/n.md", heading: "# Notes" },
  checklist: { file: "/c.md", heading: "# Items" },
};

const NO_SOURCE: CaptureSource = { url: "", title: "", app: "" };

/** Assert a plan is a `write` and return it narrowed, so tests can read write-only fields. */
function writeOf<T extends { kind: string }>(
  p: T,
): Extract<T, { kind: "write" }> {
  expect(p.kind).toBe("write");
  return p as Extract<T, { kind: "write" }>;
}

function inputs(over: Partial<CaptureInputs> = {}): CaptureInputs {
  return {
    selected: "",
    clipboard: "",
    usedClipboard: false,
    inTerminal: false,
    ...over,
  };
}

function plan(
  over: {
    args?: { text?: string; project?: string };
    inputs?: Partial<CaptureInputs>;
    source?: CaptureSource;
    config?: typeof CONFIG;
    mergeSeparator?: string;
  } = {},
) {
  return planSilentAppend({
    args: over.args ?? {},
    inputs: inputs(over.inputs),
    source: over.source ?? NO_SOURCE,
    config: over.config ?? CONFIG,
    now: NOW,
    dateFormat: DATE_FORMAT,
    mergeSeparator: over.mergeSeparator ?? "semicolon",
  });
}

describe("planSilentAppend", () => {
  describe("write — checklist (single line)", () => {
    // The typed argument is the `extra` var, which the checklist template renders in backticks
    // (an inline-code span) — see templates.test.ts. Plain-text pieces come via selection/clipboard.
    test("argument only: checklist item (extra backticked) to the checklist target", () => {
      expect(plan({ args: { text: "buy milk" } })).toEqual({
        kind: "write",
        format: "checklist",
        file: "/c.md",
        heading: "# Items",
        groupText: GROUP,
        line: "- [ ] **14:30**: `buy milk`",
        updated: UPDATED,
      });
    });

    test("selection only", () => {
      expect(writeOf(plan({ inputs: { selected: "from editor" } })).line).toBe(
        "- [ ] **14:30**: from editor",
      );
    });

    test("clipboard only", () => {
      expect(
        writeOf(plan({ inputs: { clipboard: "clip", usedClipboard: true } }))
          .line,
      ).toBe("- [ ] **14:30**: clip");
    });

    test("argument + selection + clipboard merge in order (extra is backticked)", () => {
      const p = plan({
        args: { text: "note" },
        inputs: { selected: "sel", clipboard: "clip", usedClipboard: true },
      });
      expect(p).toMatchObject({
        kind: "write",
        format: "checklist",
        line: "- [ ] **14:30**: `note`; sel; clip",
      });
    });

    test("project renders as an [!!info:] prefix before the backticked extra", () => {
      expect(
        writeOf(plan({ args: { text: "buy milk", project: "Work" } })).line,
      ).toBe("- [ ] **14:30**: `[!!info:Work]` `buy milk`");
    });

    test("browser source: inline link + app name (plain selection body)", () => {
      const p = writeOf(
        plan({
          inputs: { selected: "buy milk" },
          source: {
            url: "https://example.com/a",
            title: "Great Article",
            app: "Safari",
          },
        }),
      );
      expect(p.line).toBe(
        "- [ ] **14:30**: buy milk [link](https://example.com/a) (Safari)",
      );
    });

    test("space separator joins pieces with a single space", () => {
      const p = plan({
        args: { text: "a" },
        inputs: { selected: "b" },
        mergeSeparator: "space",
      });
      expect(p).toMatchObject({
        format: "checklist",
        line: "- [ ] **14:30**: `a` b",
      });
    });
  });

  describe("write — note (multi-line)", () => {
    test("multi-line selection routes to the note target with the note template", () => {
      const p = plan({ inputs: { selected: "line one\nline two" } });
      expect(p).toMatchObject({
        kind: "write",
        format: "note",
        file: "/n.md",
        heading: "# Notes",
        groupText: GROUP,
        updated: UPDATED,
      });
      expect(p.kind === "write" && p.line.startsWith("**14:30**")).toBe(true);
    });

    test("newline separator turns a multi-part capture into a note block", () => {
      // Regression guard: the separator choice must drive routing, not just glue.
      const p = plan({
        args: { text: "first" },
        inputs: { selected: "second" },
        mergeSeparator: "newline",
      });
      expect(p.kind).toBe("write");
      expect(p.kind === "write" && p.format).toBe("note");
    });
  });

  describe("empty capture", () => {
    test("nothing captured, not a terminal, clipboard off → emptyGeneric (usedClipboard false)", () => {
      expect(plan({})).toEqual({ kind: "emptyGeneric", usedClipboard: false });
    });

    test("nothing captured with clipboard on → emptyGeneric (usedClipboard true)", () => {
      expect(plan({ inputs: { usedClipboard: true } })).toEqual({
        kind: "emptyGeneric",
        usedClipboard: true,
      });
    });

    test("nothing captured in a non-AX terminal → emptyTerminal", () => {
      expect(
        plan({ inputs: { inTerminal: true, usedClipboard: true } }),
      ).toEqual({ kind: "emptyTerminal" });
    });

    test("whitespace-only argument counts as empty", () => {
      expect(plan({ args: { text: "   \n  " } })).toEqual({
        kind: "emptyGeneric",
        usedClipboard: false,
      });
    });
  });

  describe("missing target file", () => {
    test("single-line capture but checklist file unset → missingTarget checklist", () => {
      const p = plan({
        args: { text: "buy milk" },
        config: {
          note: { file: "/n.md", heading: "# Notes" },
          checklist: { file: "", heading: "# Items" },
        },
      });
      expect(p).toEqual({ kind: "missingTarget", format: "checklist" });
    });

    test("multi-line capture but note file unset → missingTarget note", () => {
      const p = plan({
        inputs: { selected: "l1\nl2" },
        config: {
          note: { file: "  ", heading: "# Notes" },
          checklist: { file: "/c.md", heading: "# Items" },
        },
      });
      expect(p).toEqual({ kind: "missingTarget", format: "note" });
    });
  });
});

function planCreate(
  over: {
    args?: { text?: string; project?: string; title?: string };
    inputs?: Partial<CaptureInputs>;
    source?: CaptureSource;
    directory?: string;
    frontmatter?: string;
    tags?: string[];
    mergeSeparator?: string;
  } = {},
) {
  return planSilentCreate({
    args: over.args ?? {},
    inputs: inputs(over.inputs),
    source: over.source ?? NO_SOURCE,
    directory: over.directory ?? "/tasks",
    template: TEMPLATES.task,
    frontmatter: over.frontmatter ?? "type: task",
    tags: over.tags ?? [],
    now: NOW,
    dateFormat: DATE_FORMAT,
    filenameDateFormat: "yyyy-MM-dd-HHmmss",
    mergeSeparator: over.mergeSeparator ?? "semicolon",
  });
}

describe("planSilentCreate", () => {
  describe("write", () => {
    test("argument content → file body + timestamped filename in the directory", () => {
      const p = planCreate({ args: { text: "buy milk" } });
      expect(p.kind).toBe("write");
      if (p.kind !== "write") return;
      expect(p.directory).toBe("/tasks");
      expect(p.filename).toBe("2026-07-08-143000.md");
      expect(p.file).toContain("type: task");
      expect(p.file).toContain("created: 2026-07-08T14:30:00");
      expect(p.file).toContain("buy milk");
    });

    test("title-only capture is valid (content blank; YAML-quoted via yamlScalar)", () => {
      const p = planCreate({ args: { title: "Just a title" } });
      expect(p.kind).toBe("write");
      if (p.kind !== "write") return;
      expect(p.file).toContain('title: "Just a title"');
    });

    test("project-only capture is valid", () => {
      const p = planCreate({ args: { project: "Work" } });
      expect(p.kind).toBe("write");
    });

    test("tags flow into the frontmatter", () => {
      const p = planCreate({ args: { text: "x" }, tags: ["a", "b"] });
      expect(p.kind === "write" && p.file).toContain("tags:");
    });

    test("filenameFormat is separate from the created datetime format", () => {
      const p = planCreate({ args: { text: "x" } });
      expect(p.kind === "write" && p.filename).toBe("2026-07-08-143000.md");
    });
  });

  describe("guards", () => {
    test("empty directory → missingDirectory (checked before capture)", () => {
      expect(planCreate({ args: { text: "x" }, directory: "  " })).toEqual({
        kind: "missingDirectory",
      });
    });

    test("content + title + project all blank → empty", () => {
      expect(planCreate({})).toEqual({ kind: "empty" });
    });

    test("whitespace-only across all fields → empty", () => {
      expect(
        planCreate({ args: { text: "  ", title: "  ", project: "  " } }),
      ).toEqual({ kind: "empty" });
    });
  });

  describe("frontmatter errors surface (thrown by buildCreateFile)", () => {
    test("a malformed frontmatter pref throws — the adapter turns it into a Toast", () => {
      expect(() =>
        planCreate({ args: { text: "x" }, frontmatter: "no-colon-here" }),
      ).toThrow();
    });
  });
});

const FORM_APPEND_CONFIG = {
  note: { file: "/n.md", heading: "# Notes" },
  checklist: { file: "/c.md", heading: "# Items" },
};

describe("planFormAppend", () => {
  // The Form is WYSIWYG: the block renders from the Content field ONLY (content === selected),
  // the Clipboard/Title fields never bleed into the append, and app is "" (Raycast is frontmost).
  function run(
    over: {
      content?: string;
      project?: string;
      url?: string;
      config?: typeof FORM_APPEND_CONFIG;
    } = {},
  ) {
    return planFormAppend({
      content: over.content ?? "buy milk",
      project: over.project ?? "",
      url: over.url ?? "",
      config: over.config ?? FORM_APPEND_CONFIG,
      now: NOW,
      dateFormat: DATE_FORMAT,
    });
  }

  test("single-line content → checklist item, rendered verbatim (NOT backticked)", () => {
    // Distinct from silent: the Form's content is the `selected` var, not `extra`, so no backticks.
    expect(run({ content: "buy milk" })).toEqual({
      kind: "write",
      format: "checklist",
      file: "/c.md",
      heading: "# Items",
      groupText: GROUP,
      line: "- [ ] **14:30**: buy milk",
      updated: UPDATED,
    });
  });

  test("multi-line content → note block to the note target", () => {
    const p = run({ content: "line one\nline two" });
    expect(p).toMatchObject({ kind: "write", format: "note", file: "/n.md" });
  });

  test("a filled URL field attaches an inline link", () => {
    expect(run({ content: "buy milk", url: "https://x.test" }).kind).toBe(
      "write",
    );
    expect(
      planFormAppend({
        content: "buy milk",
        project: "",
        url: "https://x.test",
        config: FORM_APPEND_CONFIG,
        now: NOW,
        dateFormat: DATE_FORMAT,
      }),
    ).toMatchObject({
      line: "- [ ] **14:30**: buy milk [link](https://x.test)",
    });
  });

  test("blank content → empty (Form's guard is content-only)", () => {
    expect(run({ content: "   " })).toEqual({ kind: "empty" });
  });

  test("target file unset → missingTarget", () => {
    const p = run({
      content: "buy milk",
      config: {
        note: { file: "/n.md", heading: "# Notes" },
        checklist: { file: "", heading: "# Items" },
      },
    });
    expect(p).toEqual({ kind: "missingTarget", format: "checklist" });
  });
});

describe("planFormCreate", () => {
  function run(
    over: {
      content?: string;
      title?: string;
      project?: string;
      url?: string;
      tags?: string[];
      directory?: string;
      frontmatter?: string;
    } = {},
  ) {
    return planFormCreate({
      content: over.content ?? "buy milk",
      title: over.title ?? "",
      project: over.project ?? "",
      url: over.url ?? "",
      tags: over.tags ?? [],
      directory: over.directory ?? "/notes",
      frontmatter: over.frontmatter ?? "type: note",
      now: NOW,
      dateFormat: DATE_FORMAT,
      filenameDateFormat: "yyyy-MM-dd-HHmmss",
    });
  }

  test("composes the file + collision-free filename in the directory", () => {
    const p = run({ content: "buy milk" });
    expect(p.kind).toBe("write");
    if (p.kind !== "write") return;
    expect(p.directory).toBe("/notes");
    expect(p.filename).toBe("2026-07-08-143000.md");
    expect(p.file).toContain("type: note");
    expect(p.file).toContain("buy milk");
  });

  test("empty directory → missingDirectory", () => {
    expect(run({ directory: "" })).toEqual({ kind: "missingDirectory" });
  });

  test("a trimmed URL becomes the source_url frontmatter (YAML-quoted for the colon)", () => {
    const p = run({ content: "x", url: "  https://x.test  " });
    expect(p.kind === "write" && p.file).toContain(
      'source_url: "https://x.test"',
    );
  });

  test("malformed frontmatter pref throws", () => {
    expect(() => run({ frontmatter: "bogus" })).toThrow();
  });
});
