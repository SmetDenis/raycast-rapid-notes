// Characters forbidden in filenames on Windows (a superset of macOS/Linux).
const FORBIDDEN = /[\\/:*?"<>|]+/g;

/** Make a string safe to use as a filename on macOS and Windows. */
export function sanitizeFilename(name: string): string {
  return name
    .replace(FORBIDDEN, "-")
    .replace(/-+/g, "-")
    .replace(/^[-\s]+|[-\s]+$/g, "");
}

/**
 * Build a collision-free note filename from a timestamp stamp (sanitized defensively). The
 * first free name is `<stamp><ext>`; on the rare clash (`exists` returns true) a numeric
 * suffix is added (`<stamp>-2<ext>`, `-3`, …) so a note is never overwritten or merged.
 */
export function uniqueFilename(
  stamp: string,
  exists: (filename: string) => boolean,
  ext = ".md",
): string {
  const base = sanitizeFilename(stamp);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${base}${ext}` : `${base}-${n}${ext}`;
    if (!exists(candidate)) return candidate;
  }
}
