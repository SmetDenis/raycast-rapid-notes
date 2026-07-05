// Characters forbidden in filenames on Windows (a superset of macOS/Linux).
const FORBIDDEN = /[\\/:*?"<>|]+/g;

/** Make a string safe to use as a filename on macOS and Windows. */
export function sanitizeFilename(name: string): string {
  return name
    .replace(FORBIDDEN, "-")
    .replace(/-+/g, "-")
    .replace(/^[-\s]+|[-\s]+$/g, "");
}

/** Build a note filename from a timestamp stamp, sanitizing it defensively. */
export function noteFilename(stamp: string, ext = ".md"): string {
  return sanitizeFilename(stamp) + ext;
}
