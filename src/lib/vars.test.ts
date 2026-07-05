import { describe, expect, test } from "vitest";
import { buildTemplateVars } from "./vars";

describe("buildTemplateVars", () => {
  test("wires date/time/datetime and passes through content, url, title", () => {
    const now = new Date(2026, 6, 5, 14, 32, 9);
    expect(
      buildTemplateVars({
        content: "c",
        url: "u",
        title: "t",
        now,
        dateFormat: "yyyy-MM-dd'T'HH:mm:ss",
      }),
    ).toEqual({
      content: "c",
      url: "u",
      title: "t",
      date: "2026-07-05",
      time: "14:32",
      datetime: "2026-07-05T14:32:09",
    });
  });
});
