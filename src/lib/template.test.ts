import { describe, expect, test } from "vitest";
import { renderTemplate } from "./template";

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
});
