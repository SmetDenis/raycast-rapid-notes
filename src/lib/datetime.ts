import { format } from "date-fns";

/**
 * Format a date with a date-fns format string. Thin wrapper so commands stay
 * free of date-fns detail and formats are testable. Note: date-fns uses
 * lowercase `yyyy`/`dd` (uppercase `YYYY`/`DD` are week-year/day-of-year);
 * an invalid format string throws — callers surface that to the user.
 */
export function formatDate(date: Date, fmt: string): string {
  return format(date, fmt);
}
