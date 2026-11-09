// Stay dates are calendar dates ("YYYY-MM-DD"). They are stored as UTC
// midnight so that a night never shifts because of a server's time zone.
// "Today" is evaluated in India Standard Time, where the resort is.

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && toIsoDate(d) === s;
}

export function parseIsoDate(s: string): Date {
  if (!isIsoDate(s)) throw new Error(`Invalid date: ${s}`);
  return new Date(`${s}T00:00:00Z`);
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
}

/** Every night of a stay: checkIn inclusive, checkOut exclusive. */
export function stayNights(checkIn: Date, checkOut: Date): Date[] {
  const n = nightsBetween(checkIn, checkOut);
  return Array.from({ length: Math.max(0, n) }, (_, i) => addDays(checkIn, i));
}

/** Today's calendar date in IST, as a UTC-midnight Date. */
export function todayIST(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return parseIsoDate(ist.toISOString().slice(0, 10));
}

const fmtShort = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtLong = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatShort(d: Date): string {
  return fmtShort.format(d);
}
export function formatLong(d: Date): string {
  return fmtLong.format(d);
}
export function formatRange(a: Date, b: Date): string {
  return `${formatShort(a)} – ${formatLong(b)}`;
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

export function timeAgo(d: Date, now: Date = new Date()): string {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
