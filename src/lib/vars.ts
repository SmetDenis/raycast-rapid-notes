import { formatDate } from "./datetime";
import type { TemplateVars } from "./template";

export interface VarsInput {
  content: string;
  url: string;
  title: string;
  now: Date;
  dateFormat: string;
}

/** Build the placeholder variables for a template render. */
export function buildTemplateVars({
  content,
  url,
  title,
  now,
  dateFormat,
}: VarsInput): TemplateVars {
  return {
    content,
    url,
    title,
    date: formatDate(now, "yyyy-MM-dd"),
    time: formatDate(now, "HH:mm"),
    datetime: formatDate(now, dateFormat),
  };
}
