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
    test("reads the clipboard and skips the selection, even with useClipboard OFF", async () => {
      // Real-world probe: Ghostty gave sel=0, clip=79 with copy-on-select=clipboard.
      const r = readers("", "selected in Ghostty");
      const out = await readCaptureInputs(
        { bundleId: "com.mitchellh.ghostty", useClipboard: false },
        r,
      );
      expect(out).toEqual({
        selected: "",
        clipboard: "selected in Ghostty",
        usedClipboard: true,
      });
    });

    test("does NOT call readSelection (its Cmd+C fallback would fire SIGINT uselessly)", async () => {
      const r = readers("ignored", "clip text");
      await readCaptureInputs(
        { bundleId: "net.kovidgoyal.kitty", useClipboard: false },
        r,
      );
      expect(r.readSelection).not.toHaveBeenCalled();
      expect(r.readClipboard).toHaveBeenCalledOnce();
    });

    test("never produces a `selected; clipboard` duplicate if AX ever starts returning text", async () => {
      // Guard the future case (Ghostty PR #11196): even if the selection reader returned text,
      // the terminal branch ignores it, so selected stays "" and the merge can't double up.
      const r = readers("foo", "foo");
      const out = await readCaptureInputs(
        { bundleId: "com.mitchellh.ghostty", useClipboard: true },
        r,
      );
      expect(out.selected).toBe("");
    });
  });

  describe("native AX terminal / ordinary app", () => {
    test("useClipboard ON: reads both selection and clipboard", async () => {
      const r = readers("the selection", "the clipboard");
      const out = await readCaptureInputs(
        { bundleId: "com.apple.Terminal", useClipboard: true },
        r,
      );
      expect(out).toEqual({
        selected: "the selection",
        clipboard: "the clipboard",
        usedClipboard: true,
      });
    });

    test("useClipboard OFF: reads only the selection, clipboard stays empty and untouched", async () => {
      const r = readers("the selection", "stale clipboard");
      const out = await readCaptureInputs(
        { bundleId: "com.googlecode.iterm2", useClipboard: false },
        r,
      );
      expect(out).toEqual({
        selected: "the selection",
        clipboard: "",
        usedClipboard: false,
      });
      expect(r.readClipboard).not.toHaveBeenCalled();
    });

    test("undefined bundleId is treated as an ordinary app (not a terminal)", async () => {
      const r = readers("sel", "clip");
      const out = await readCaptureInputs(
        { bundleId: undefined, useClipboard: false },
        r,
      );
      expect(out).toEqual({
        selected: "sel",
        clipboard: "",
        usedClipboard: false,
      });
    });
  });
});
