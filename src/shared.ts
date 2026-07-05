import { BrowserExtension, getSelectedText } from "@raycast/api";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Selected text of the frontmost app, or "" if nothing is selected / access is denied. */
export async function readSelection(): Promise<string> {
  try {
    return await getSelectedText();
  } catch {
    return "";
  }
}

export interface ActiveTab {
  url: string;
  title: string;
}

/** Active browser tab url + title (best-effort; empty if the Browser Extension is absent). */
export async function readActiveTab(): Promise<ActiveTab> {
  try {
    const tabs = await BrowserExtension.getTabs();
    const active = tabs.find((tab) => tab.active);
    return { url: active?.url ?? "", title: active?.title ?? "" };
  } catch {
    return { url: "", title: "" };
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
