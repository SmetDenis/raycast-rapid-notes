import {
  BrowserExtension,
  Clipboard,
  environment,
  getDefaultApplication,
  getFrontmostApplication,
  getSelectedText,
} from "@raycast/api";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isBrowserApp } from "./lib/browser";

/** Selected text of the frontmost app, or "" if nothing is selected / access is denied. */
export async function readSelection(): Promise<string> {
  try {
    return await getSelectedText();
  } catch {
    return "";
  }
}

export interface SelectionResult {
  text: string;
  /** True only when the text actually came from the clipboard fallback (selection was empty). */
  fromClipboard: boolean;
}

/**
 * Selected text, optionally falling back to the clipboard as a LAST resort when the
 * selection is empty. `getSelectedText` can't reach apps that don't expose a selection
 * to a focused Form (e.g. Telegram / Electron); with the fallback on, the user copies
 * first. The selection always wins; the clipboard is read only when it is empty AND the
 * caller opted in (the `clipboardFallback` preference). The text is returned VERBATIM
 * (untrimmed) so `{content_f}` can wrap it exactly as-is; emptiness is decided on the
 * trimmed value, and callers trim where they need to (`{content}`, empty checks).
 */
export async function readSelectionOrClipboard(
  useClipboardFallback: boolean,
): Promise<SelectionResult> {
  const selection = await readSelection();
  if (selection.trim() || !useClipboardFallback) {
    return { text: selection, fromClipboard: false };
  }
  const clip = (await Clipboard.readText()) ?? "";
  return { text: clip, fromClipboard: clip.trim().length > 0 };
}

export interface Source {
  /** Frontmost source app name (always best-effort); "" if it can't be resolved. */
  app: string;
  /** Active browser tab url/title — only when the source is a browser, else "". */
  url: string;
  title: string;
}

/**
 * Capture context of the frontmost app: its name always (best-effort), plus the active
 * browser tab url + title WHEN the source is a browser (otherwise "", so a selection from
 * another app never grabs an unrelated background tab). Tab reads need the Browser
 * Extension; the app name works without it.
 */
export async function readSource(): Promise<Source> {
  let app = "";
  try {
    const [frontmost, defaultBrowser] = await Promise.all([
      getFrontmostApplication(),
      getDefaultApplication("https://example.com").catch(() => undefined),
    ]);
    app = frontmost.name ?? "";
    if (
      !environment.canAccess(BrowserExtension) ||
      !isBrowserApp(frontmost.bundleId, defaultBrowser?.bundleId)
    ) {
      return { app, url: "", title: "" };
    }
    const tabs = await BrowserExtension.getTabs();
    const active = tabs.find((tab) => tab.active);
    return { app, url: active?.url ?? "", title: active?.title ?? "" };
  } catch {
    return { app, url: "", title: "" };
  }
}

/** Read a UTF-8 file. A missing file (ENOENT) returns ""; any other error is surfaced. */
export function readFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "";
    }
    throw error;
  }
}

/** Write a UTF-8 file, creating parent directories as needed. */
export function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
