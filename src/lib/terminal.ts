// Bundle ids of GPU-rendered terminal emulators that do NOT expose the selection through the
// macOS Accessibility API. In these, getSelectedText() returns "" (AX yields nothing, and the
// Cmd+C fallback can't recover it), so a Silent capture must read the system clipboard instead —
// which holds the current selection when the terminal has copy-on-select enabled.
// Verified locally by Info.plist: Ghostty, kitty. Alacritty/WezTerm/cmux ids are from their
// published manifests/source (not verified on this machine); a wrong id is a harmless no-op (no
// auto-clipboard for that app, i.e. the current behaviour), never a crash.
export const KNOWN_NON_AX_TERMINAL_BUNDLE_IDS = [
  "com.mitchellh.ghostty",
  "net.kovidgoyal.kitty",
  "org.alacritty",
  "com.github.wez.wezterm",
  "com.cmuxterm.app", // cmux (stable channel)
  "com.cmuxterm.app.nightly", // cmux (nightly channel)
];

/**
 * Whether an app (by bundle id) is a GPU terminal that can't surface its selection via the
 * Accessibility API, so a Silent capture should read the clipboard even when the useClipboard
 * preference is off. Native AX terminals (Terminal.app, iTerm2) are deliberately EXCLUDED: their
 * selection reads fine through getSelectedText(), so auto-reading the clipboard there would risk
 * merging stale clipboard text with the real selection.
 */
export function isNonAxTerminal(bundleId: string | undefined): boolean {
  if (!bundleId) return false;
  return KNOWN_NON_AX_TERMINAL_BUNDLE_IDS.includes(bundleId);
}
