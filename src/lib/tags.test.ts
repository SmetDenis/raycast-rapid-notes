import { describe, expect, test } from "vitest";
import { parseTags } from "./tags";

describe("parseTags", () => {
  test("splits a comma-separated string", () => {
    expect(parseTags("a, b, c")).toEqual(["a", "b", "c"]);
  });

  test("trims surrounding whitespace on each tag", () => {
    expect(parseTags("  a ,   b  ")).toEqual(["a", "b"]);
  });

  test("drops empty entries from extra or trailing commas", () => {
    expect(parseTags("a,,b,")).toEqual(["a", "b"]);
  });

  test("returns an empty array for a blank string", () => {
    expect(parseTags("   ")).toEqual([]);
  });

  test("strips a leading # so tags are YAML-safe", () => {
    expect(parseTags("#work, home")).toEqual(["work", "home"]);
  });

  test("removes duplicates, keeping first occurrence order", () => {
    expect(parseTags("a, b, a")).toEqual(["a", "b"]);
  });
});
