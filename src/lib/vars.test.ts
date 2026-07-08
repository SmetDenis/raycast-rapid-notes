import { describe, expect, test } from "vitest";
import { parseTags } from "./tags";
import { buildTemplateVars } from "./vars";

const NOW = new Date(2026, 6, 5, 14, 32, 9); // Sunday 2026-07-05 14:32:09
const FMT = "yyyy-MM-dd'T'HH:mm:ss";

describe("buildTemplateVars", () => {
  test("renders every placeholder for a full browser capture", () => {
    expect(
      buildTemplateVars({
        content: "  Selected text  ",
        extra: " typed note ",
        selected: "  Selected text  ",
        clipboard: "clip me",
        url: "https://example.com",
        title: "Some title",
        app: "Telegram",
        project: "Work",
        now: NOW,
        dateFormat: FMT,
        tags: ["work", "urgent"],
      }),
    ).toEqual({
      // capture trio — raw
      content: "Selected text",
      selected: "Selected text",
      clipboard: "clip me",
      // capture trio — inline
      content_inline: "Selected text",
      selected_inline: "Selected text",
      clipboard_inline: "clip me",
      // capture trio — formatted
      content_f: "````text\n  Selected text  \n````\n",
      selected_f: "Selected: Selected text\n",
      clipboard_f: "Clipboard: clip me\n",
      // inputs
      extra: "typed note",
      extra_f: "Extra: typed note\n",
      project: "Work",
      project_f: "Project: Work\n",
      // source
      url: "https://example.com",
      url_f: "Url: <https://example.com>\n",
      title: "Some title",
      title_f: "Title: Some title\n",
      app: "Telegram",
      app_f: "From app: Telegram\n",
      page: "[Some title](https://example.com)",
      page_f: "Page: [Some title](https://example.com)\n",
      link: "[link](https://example.com)",
      link_f: "[link](https://example.com)\n",
      // tags
      tags: "work, urgent",
      tags_f: "Tags: #work, #urgent\n",
      // date/time
      date: "Sun, 5 July 2026",
      time: "14:32",
      datetime: "2026-07-05T14:32:09",
    });
  });

  test("collapses empty url/title/app/project (raw, _f, and page) to an empty string", () => {
    const v = buildTemplateVars({
      content: "x",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(v.url).toBe("");
    expect(v.url_f).toBe("");
    expect(v.title).toBe("");
    expect(v.title_f).toBe("");
    expect(v.app).toBe("");
    expect(v.app_f).toBe("");
    expect(v.project).toBe("");
    expect(v.project_f).toBe("");
    expect(v.page).toBe("");
    expect(v.page_f).toBe("");
  });

  test("trims {project} and renders {project_f} as a labeled line", () => {
    const v = buildTemplateVars({
      content: "x",
      url: "",
      title: "",
      app: "",
      project: "  Home  ",
      now: NOW,
      dateFormat: FMT,
    });
    expect(v.project).toBe("Home");
    expect(v.project_f).toBe("Project: Home\n");
  });

  test("trims {content} but wraps {content_f} verbatim in a four-backtick fence", () => {
    const v = buildTemplateVars({
      content: "  line1\nline2  ",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(v.content).toBe("line1\nline2");
    expect(v.content_f).toBe("````text\n  line1\nline2  \n````\n");
  });

  test("collapses whitespace-only content to '' for both {content} and {content_f}", () => {
    const v = buildTemplateVars({
      content: "   \n  ",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(v.content).toBe("");
    expect(v.content_f).toBe("");
  });

  test("{page} adapts to an autolink when only the url is present", () => {
    const v = buildTemplateVars({
      content: "x",
      url: "https://example.com",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(v.page).toBe("<https://example.com>");
    expect(v.page_f).toBe("Page: <https://example.com>\n");
  });

  test("{page} adapts to plain text when only the title is present", () => {
    const v = buildTemplateVars({
      content: "x",
      url: "",
      title: "Some title",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(v.page).toBe("Some title");
    expect(v.page_f).toBe("Page: Some title\n");
  });

  test("joins tags for {tags} and labels them for {tags_f}", () => {
    const v = buildTemplateVars({
      content: "x",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
      tags: ["work", "urgent"],
    });
    expect(v.tags).toBe("work, urgent");
    expect(v.tags_f).toBe("Tags: #work, #urgent\n");
  });

  test("collapses missing/empty tags to '' for both {tags} and {tags_f}", () => {
    const v = buildTemplateVars({
      content: "x",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(v.tags).toBe("");
    expect(v.tags_f).toBe("");
  });

  test("collapses whitespace to one space and trims for the _inline trio", () => {
    const v = buildTemplateVars({
      content: "a\n\nb  c",
      selected: "  s1\ts2 ",
      clipboard: "line1\nline2",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(v.content_inline).toBe("a b c");
    expect(v.selected_inline).toBe("s1 s2");
    expect(v.clipboard_inline).toBe("line1 line2");
  });

  test("labels selected_f/clipboard_f and collapses empty ones to ''", () => {
    const present = buildTemplateVars({
      content: "x",
      selected: " sel ",
      clipboard: " clip ",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(present.selected_f).toBe("Selected: sel\n");
    expect(present.clipboard_f).toBe("Clipboard: clip\n");
    const empty = buildTemplateVars({
      content: "x",
      selected: "   ",
      clipboard: "",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(empty.selected).toBe("");
    expect(empty.selected_f).toBe("");
    expect(empty.selected_inline).toBe("");
    expect(empty.clipboard).toBe("");
    expect(empty.clipboard_f).toBe("");
  });

  test("exposes {extra}/{extra_f} trimmed and labeled, empty when blank", () => {
    const v = buildTemplateVars({
      content: "x",
      extra: "  note  ",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(v.extra).toBe("note");
    expect(v.extra_f).toBe("Extra: note\n");
    const blank = buildTemplateVars({
      content: "x",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(blank.extra).toBe("");
    expect(blank.extra_f).toBe("");
  });

  test("builds {link}/{link_f}, empty when there is no url", () => {
    const withUrl = buildTemplateVars({
      content: "x",
      url: "https://example.com",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(withUrl.link).toBe("[link](https://example.com)");
    expect(withUrl.link_f).toBe("[link](https://example.com)\n");
    const noUrl = buildTemplateVars({
      content: "x",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
    });
    expect(noUrl.link).toBe("");
    expect(noUrl.link_f).toBe("");
  });

  test("prefixes # in {tags_f} but keeps {tags} bare", () => {
    const v = buildTemplateVars({
      content: "x",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
      tags: ["work", "urgent"],
    });
    expect(v.tags).toBe("work, urgent");
    expect(v.tags_f).toBe("Tags: #work, #urgent\n");
  });

  test("re-adds # in {tags_f} after parseTags strips a leading # (no ##)", () => {
    const v = buildTemplateVars({
      content: "x",
      url: "",
      title: "",
      app: "",
      project: "",
      now: NOW,
      dateFormat: FMT,
      tags: parseTags("#work, urgent"),
    });
    expect(v.tags).toBe("work, urgent");
    expect(v.tags_f).toBe("Tags: #work, #urgent\n");
  });
});
