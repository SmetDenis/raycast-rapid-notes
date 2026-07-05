import { describe, expect, test } from "vitest";
import { renderTemplate, unescapeTemplate } from "./template";

describe("renderTemplate", () => {
  test("replaces a known placeholder with its value", () => {
    expect(renderTemplate("- [ ] {content}", { content: "buy milk" })).toBe(
      "- [ ] buy milk",
    );
  });

  test("replaces multiple distinct placeholders", () => {
    expect(
      renderTemplate("{title}: {content}", {
        title: "Todo",
        content: "ship it",
      }),
    ).toBe("Todo: ship it");
  });

  test("replaces every occurrence of a repeated placeholder", () => {
    expect(renderTemplate("{x}-{x}", { x: "a" })).toBe("a-a");
  });

  test("replaces a known placeholder that has an empty value with nothing", () => {
    expect(renderTemplate("start{url}end", { url: "" })).toBe("startend");
  });

  test("leaves unknown placeholders untouched", () => {
    expect(renderTemplate("{content} {unknown}", { content: "hi" })).toBe(
      "hi {unknown}",
    );
  });

  test("does not re-process text introduced by a substitution", () => {
    expect(renderTemplate("{a}", { a: "{b}", b: "X" })).toBe("{b}");
  });

  test("interprets a \\n escape in the template as a real newline", () => {
    expect(
      renderTemplate("- [ ] {content}\\nsource: {url}", {
        content: "x",
        url: "u",
      }),
    ).toBe("- [ ] x\nsource: u");
  });

  test("does not interpret escape sequences coming from a substituted value", () => {
    // A literal backslash-n in the value must stay literal, not become a newline.
    expect(renderTemplate("{content}", { content: "a\\nb" })).toBe("a\\nb");
  });
});

describe("unescapeTemplate", () => {
  test("turns \\n into a newline", () => {
    expect(unescapeTemplate("a\\nb")).toBe("a\nb");
  });

  test("turns \\t into a tab", () => {
    expect(unescapeTemplate("a\\tb")).toBe("a\tb");
  });

  test("collapses \\\\ into a single backslash", () => {
    expect(unescapeTemplate("a\\\\b")).toBe("a\\b");
  });

  test("keeps an escaped backslash-n literal (\\\\n stays \\n)", () => {
    expect(unescapeTemplate("a\\\\nb")).toBe("a\\nb");
  });

  test("leaves a string without escapes unchanged", () => {
    expect(unescapeTemplate("- [ ] {content}")).toBe("- [ ] {content}");
  });

  test("leaves an unknown escape untouched", () => {
    expect(unescapeTemplate("a\\xb")).toBe("a\\xb");
  });
});
