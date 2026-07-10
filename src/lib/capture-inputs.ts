import { isNonAxTerminal } from "./terminal";

export interface CaptureInputs {
  selected: string;
  clipboard: string;
  /** Whether the clipboard was consulted (drives the empty-capture HUD message). */
  usedClipboard: boolean;
  /** Whether the source is a non-AX GPU terminal (drives the terminal-specific empty-capture error). */
  inTerminal: boolean;
}

/** I/O the adapter injects: reading these needs `@raycast/api`, so they stay OUT of lib. */
export interface CaptureReaders {
  readSelection: () => Promise<string>;
  readClipboard: () => Promise<string>;
}

/**
 * Decide and read the capture inputs for a Silent command from two ORTHOGONAL opt-in toggles:
 * `useSelection` reads the current selection, `useClipboard` reads the clipboard. Both default
 * off on the append command, so nothing is auto-read and a stray selection (e.g. the previous
 * checklist line still highlighted in an editor) can never bleed into the merge.
 *
 * A non-AX GPU terminal (Ghostty, kitty, ...) hides its selection from the macOS Accessibility
 * API — getSelectedText() returns "" and its Cmd+C fallback fires SIGINT uselessly — so there the
 * selection is only reachable through the clipboard (copy-on-select). In that case we SKIP the
 * selection reader entirely and read the clipboard as the selection surrogate when EITHER toggle
 * is on. `inTerminal` is returned so the caller can raise a terminal-specific error when the
 * terminal capture came back empty. Readers are injected so this stays unit-testable in lib.
 */
export async function readCaptureInputs(
  opts: {
    bundleId: string | undefined;
    useSelection: boolean;
    useClipboard: boolean;
  },
  readers: CaptureReaders,
): Promise<CaptureInputs> {
  if (isNonAxTerminal(opts.bundleId)) {
    const wantsCapture = opts.useSelection || opts.useClipboard;
    return {
      selected: "",
      clipboard: wantsCapture ? await readers.readClipboard() : "",
      usedClipboard: wantsCapture,
      inTerminal: true,
    };
  }
  return {
    selected: opts.useSelection ? await readers.readSelection() : "",
    clipboard: opts.useClipboard ? await readers.readClipboard() : "",
    usedClipboard: opts.useClipboard,
    inTerminal: false,
  };
}
