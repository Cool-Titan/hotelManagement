// Daily booking export for the reservation system (ASSUMPTION: CSV, one row
// per booking, since the brief doesn't name the PMS or its import format).

export const EXPORT_COLUMNS = [
  "reference", "status", "booked_at_ist", "check_in", "check_out", "nights", "room_type", "rate_plan",
  "adults", "children", "guest_name", "guest_email", "guest_phone", "guest_country",
  "room_total_inr", "discount_inr", "gst_inr", "grand_total_inr", "promo_code", "payment_ref", "special_requests", "source",
] as const;

export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string | number | null>;

/** RFC 4180 quoting, plus neutralising spreadsheet formulas (CSV injection). */
export function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) lines.push(EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}
