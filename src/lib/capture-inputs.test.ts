import { describe, expect, test, vi } from "vitest";
import { readCaptureInputs } from "./capture-inputs";

// Spy readers standing in for the @raycast/api-backed I/O the adapter injects at runtime.
// A GPU terminal's real getSelectedText() returns "" (AX blind + Cmd+C = SIGINT), so the
// terminal-branch spy mimics that: selection "", clipboard = the copy-on-select text.
function readers(selected: string, clipboard: string) {
  return {
    readSelection: vi.fn(async () => selected),
    readClipboard: vi.fn(async () => clipboard),
  };
}

describe("readCaptureInputs", () => {
  describe("GPU terminal (non-AX): Ghostty, kitty", () => {
    test("useSelection OFF + useClipboard OFF: reads NOTHING (no stale buffer leak)", async () => {
      // The bug's terminal channel: with both toggles off, the copy-on-select buffer (which may
      // hold the previous checklist line) is never read, so it cannot bleed into the new item.
      const r = readers("ignored", "previous checklist line");
      const out = await readCaptureInputs(
        {
          bundleId: "com.mitchellh.ghostty",
          useSelection: false,
          useClipboard: false,
        },
        r,
      );
      expect(out).toEqual({
        selected: "",
        clipboard: "",
        usedClipboard: false,
        inTerminal: true,
      });
      expect(r.readSelection).not.toHaveBeenCalled();
      expect(r.readClipboard).not.toHaveBeenCalled();
    });

    test("useSelection ON: reads the clipboard surrogate, skips the selection reader", async () => {
      // Real-world probe: Ghostty gave sel=0, clip=79 with copy-on-select=clipboard. In a
      // terminal the selection is only reachable via the clipboard, so useSelection reads it there.
      const r = readers("", "selected in Ghostty");
      const out = await readCaptureInputs(
        {
          bundleId: "com.mitchellh.ghostty",
          useSelection: true,
          useClipboard: false,
        },
        r,
      );
      expect(out).toEqual({
        selected: "",
        clipboard: "selected in Ghostty",
        usedClipboard: true,
        inTerminal: true,
      });
      expect(r.readSelection).not.toHaveBeenCalled();
      expect(r.readClipboard).toHaveBeenCalledOnce();
    });

    test("useClipboard ON (selection OFF): still reads the buffer once", async () => {
      const r = readers("", "clip text");
      const out = await readCaptureInputs(
        {
          bundleId: "net.kovidgoyal.kitty",
          useSelection: false,
          useClipboard: true,
        },
        r,
      );
      expect(out).toEqual({
        selected: "",
        clipboard: "clip text",
        usedClipboard: true,
        inTerminal: true,
      });
      expect(r.readSelection).not.toHaveBeenCalled();
      expect(r.readClipboard).toHaveBeenCalledOnce();
    });

    test("never produces a `selected; clipboard` duplicate if AX ever starts returning text", async () => {
      // Guard the future case (Ghostty PR #11196): even if the selection reader returned text,
      // the terminal branch ignores it, so selected stays "" and the merge can't double up.
      const r = readers("foo", "foo");
      const out = await readCaptureInputs(
        {
          bundleId: "com.mitchellh.ghostty",
          useSelection: true,
          useClipboard: true,
        },
        r,
      );
      expect(out.selected).toBe("");
    });
  });

  describe("native AX terminal / ordinary app", () => {
    test("useSelection OFF + useClipboard OFF: reads NOTHING (fixes the Obsidian leak)", async () => {
      // The bug's AX channel: an editor (Obsidian) selection would otherwise bleed the previous
      // line into the merge. With useSelection off (the default), the selection is never read.
      const r = readers("previous checklist line", "stale clip");
      const out = await readCaptureInputs(
        { bundleId: "md.obsidian", useSelection: false, useClipboard: false },
        r,
      );
      expect(out).toEqual({
        selected: "",
        clipboard: "",
        usedClipboard: false,
        inTerminal: false,
      });
      expect(r.readSelection).not.toHaveBeenCalled();
      expect(r.readClipboard).not.toHaveBeenCalled();
    });

    test("useSelection ON, useClipboard OFF: reads only the selection", async () => {
      const r = readers("the selection", "stale clipboard");
      const out = await readCaptureInputs(
        {
          bundleId: "com.googlecode.iterm2",
          useSelection: true,
          useClipboard: false,
        },
        r,
      );
      expect(out).toEqual({
        selected: "the selection",
        clipboard: "",
        usedClipboard: false,
        inTerminal: false,
      });
      expect(r.readClipboard).not.toHaveBeenCalled();
    });

    test("useSelection OFF, useClipboard ON: reads only the clipboard", async () => {
      const r = readers("the selection", "the clipboard");
      const out = await readCaptureInputs(
        { bundleId: "md.obsidian", useSelection: false, useClipboard: true },
        r,
      );
      expect(out).toEqual({
        selected: "",
        clipboard: "the clipboard",
        usedClipboard: true,
        inTerminal: false,
      });
      expect(r.readSelection).not.toHaveBeenCalled();
    });

    test("useSelection ON + useClipboard ON: reads both", async () => {
      const r = readers("the selection", "the clipboard");
      const out = await readCaptureInputs(
        {
          bundleId: "com.apple.Terminal",
          useSelection: true,
          useClipboard: true,
        },
        r,
      );
      expect(out).toEqual({
        selected: "the selection",
        clipboard: "the clipboard",
        usedClipboard: true,
        inTerminal: false,
      });
    });

    test("undefined bundleId is treated as an ordinary app (not a terminal)", async () => {
      const r = readers("sel", "clip");
      const out = await readCaptureInputs(
        { bundleId: undefined, useSelection: true, useClipboard: false },
        r,
      );
      expect(out).toEqual({
        selected: "sel",
        clipboard: "",
        usedClipboard: false,
        inTerminal: false,
      });
    });
  });
});
