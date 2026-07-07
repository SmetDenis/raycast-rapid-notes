import { describe, expect, test } from "vitest";
import { buildTemplateVars } from "./vars";

const NOW = new Date(2026, 6, 5, 14, 32, 9); // Sunday 2026-07-05 14:32:09
const FMT = "yyyy-MM-dd'T'HH:mm:ss";

describe("buildTemplateVars", () => {
  test("renders every placeholder for a full browser capture", () => {
    expect(
      buildTemplateVars({
        content: "  Selected text  ",
        url: "https://example.com",
        title: "Some title",
        app: "Telegram",
        project: "Work",
        now: NOW,
        dateFormat: FMT,
        tags: ["work", "urgent"],
      }),
    ).toEqual({
      // Raw values — trimmed, no label.
      content: "Selected text",
      app: "Telegram",
      url: "https://example.com",
      title: "Some title",
      project: "Work",
      page: "[Some title](https://example.com)",
      tags: "work, urgent",
      tags_f: "Tags: work, urgent\n",
      // Formatted variants — label/decoration + trailing newline.
      content_f: "````text\n  Selected text  \n````\n",
      app_f: "From app: Telegram\n",
      url_f: "Url: <https://example.com>\n",
      title_f: "Title: Some title\n",
      project_f: "Project: Work\n",
      page_f: "Page: [Some title](https://example.com)\n",
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
    expect(v.tags_f).toBe("Tags: work, urgent\n");
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
});
