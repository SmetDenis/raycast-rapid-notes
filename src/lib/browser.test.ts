import { describe, expect, test } from "vitest";
import { isBrowserApp } from "./browser";

describe("isBrowserApp", () => {
  test("recognizes Google Chrome by bundle id", () => {
    expect(isBrowserApp("com.google.Chrome")).toBe(true);
  });

  test("recognizes Safari by bundle id", () => {
    expect(isBrowserApp("com.apple.Safari")).toBe(true);
  });

  test("rejects a non-browser app", () => {
    expect(isBrowserApp("com.apple.Preview")).toBe(false);
  });

  test("rejects an undefined bundle id", () => {
    expect(isBrowserApp(undefined)).toBe(false);
  });

  test("accepts the user's default browser even if not in the known list", () => {
    expect(isBrowserApp("com.niche.Browser", "com.niche.Browser")).toBe(true);
  });

  test("still rejects a non-browser when a different default browser is set", () => {
    expect(isBrowserApp("com.apple.Preview", "com.google.Chrome")).toBe(false);
  });
});
