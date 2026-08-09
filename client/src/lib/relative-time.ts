// Shared "how long ago" formatting for dashboard staleness signals — kept
// intentionally simple (no i18n, admin-only surface) rather than pulling in
// a date library for one small utility.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeAge(date: Date | string): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - target.getTime();
  if (diffMs < MINUTE) return "just now";
  if (diffMs < HOUR) return `${Math.floor(diffMs / MINUTE)}m ago`;
  if (diffMs < DAY) return `${Math.floor(diffMs / HOUR)}h ago`;
  return `${Math.floor(diffMs / DAY)}d ago`;
}

// Staleness color tier for a date-based row — default/amber/red thresholds
// per the dashboard's "past ~1 day" / "past ~3 days" spec.
export type AgeSeverity = "default" | "amber" | "red";

export function getAgeSeverity(date: Date | string): AgeSeverity {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - target.getTime();
  if (diffMs >= 3 * DAY) return "red";
  if (diffMs >= DAY) return "amber";
  return "default";
}
