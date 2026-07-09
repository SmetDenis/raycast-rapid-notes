import { isNonAxTerminal } from "./terminal";

export interface CaptureInputs {
  selected: string;
  clipboard: string;
  /** Whether the clipboard was consulted (drives the empty-capture HUD message). */
  usedClipboard: boolean;
}

/** I/O the adapter injects: reading these needs `@raycast/api`, so they stay OUT of lib. */
export interface CaptureReaders {
  readSelection: () => Promise<string>;
  readClipboard: () => Promise<string>;
}

/**
 * Decide and read the capture inputs for a Silent command. Normally that's the selection plus,
 * when useClipboard is on, the clipboard. But a GPU terminal that hides its selection from the
 * macOS Accessibility API (Ghostty, kitty, ...) makes getSelectedText() return "" and fires its
 * Cmd+C fallback uselessly (Cmd+C = SIGINT in a terminal) — so for those we SKIP the selection
 * read entirely and read the clipboard REGARDLESS of the preference: with copy-on-select on it
 * already holds the current selection. Readers are injected so this stays unit-testable in lib.
 */
export async function readCaptureInputs(
  opts: { bundleId: string | undefined; useClipboard: boolean },
  readers: CaptureReaders,
): Promise<CaptureInputs> {
  if (isNonAxTerminal(opts.bundleId)) {
    return {
      selected: "",
      clipboard: await readers.readClipboard(),
      usedClipboard: true,
    };
  }
  return {
    selected: await readers.readSelection(),
    clipboard: opts.useClipboard ? await readers.readClipboard() : "",
    usedClipboard: opts.useClipboard,
  };
}
