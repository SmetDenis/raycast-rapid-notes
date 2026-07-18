import { describe, expect, test } from "vitest";
import { isNonAxTerminal } from "./terminal";

describe("isNonAxTerminal", () => {
  test("recognizes Ghostty by bundle id", () => {
    expect(isNonAxTerminal("com.mitchellh.ghostty")).toBe(true);
  });

  test("recognizes kitty by bundle id", () => {
    expect(isNonAxTerminal("net.kovidgoyal.kitty")).toBe(true);
  });

  test("recognizes cmux (stable and nightly channels)", () => {
    expect(isNonAxTerminal("com.cmuxterm.app")).toBe(true);
    expect(isNonAxTerminal("com.cmuxterm.app.nightly")).toBe(true);
  });

  test("recognizes agterm by bundle id", () => {
    expect(isNonAxTerminal("com.umputun.agterm")).toBe(true);
  });

  test("excludes native AX terminals (Terminal.app, iTerm2)", () => {
    expect(isNonAxTerminal("com.apple.Terminal")).toBe(false);
    expect(isNonAxTerminal("com.googlecode.iterm2")).toBe(false);
  });

  test("rejects a non-terminal app", () => {
    expect(isNonAxTerminal("com.apple.Safari")).toBe(false);
  });

  test("rejects an undefined bundle id", () => {
    expect(isNonAxTerminal(undefined)).toBe(false);
  });
});
