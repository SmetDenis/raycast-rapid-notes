// Bundle ids of browsers whose active tab the Raycast Browser Extension can read
// (Chromium-based browsers + Safari; Firefox is not supported by the extension).
export const KNOWN_BROWSER_BUNDLE_IDS = [
  "com.apple.Safari",
  "com.apple.SafariTechnologyPreview",
  "com.google.Chrome",
  "com.google.Chrome.beta",
  "com.google.Chrome.canary",
  "com.microsoft.edgemac",
  "com.brave.Browser",
  "com.brave.Browser.beta",
  "company.thebrowser.Browser", // Arc
  "com.vivaldi.Vivaldi",
  "com.operasoftware.Opera",
];

/**
 * Whether an app (by bundle id) is a browser whose active tab may be attached to a
 * capture. True when it matches the user's default browser or a known-browser bundle
 * id; used to avoid attaching an unrelated URL when the selection came from another app.
 */
export function isBrowserApp(
  bundleId: string | undefined,
  defaultBrowserBundleId?: string,
): boolean {
  if (!bundleId) return false;
  if (defaultBrowserBundleId && bundleId === defaultBrowserBundleId)
    return true;
  return KNOWN_BROWSER_BUNDLE_IDS.includes(bundleId);
}
