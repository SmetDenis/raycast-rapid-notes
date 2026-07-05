import { describe, expect, test } from "vitest";
import { formatDate } from "./datetime";

describe("formatDate", () => {
  const fixed = new Date(2026, 6, 5, 14, 32, 9); // 2026-07-05 14:32:09 local

  test("formats the default created/datetime format", () => {
    expect(formatDate(fixed, "yyyy-MM-dd'T'HH:mm:ss")).toBe(
      "2026-07-05T14:32:09",
    );
  });

  test("formats the default colon-free filename format", () => {
    expect(formatDate(fixed, "yyyy-MM-dd-HHmm")).toBe("2026-07-05-1432");
  });
});
