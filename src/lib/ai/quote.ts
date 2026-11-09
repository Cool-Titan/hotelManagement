// Builds the price block for a reply draft from the rate table. This is the
// only way a price gets into a draft.

import "server-only";
import { prisma } from "../db";
import { parseIsoDate, formatRange } from "../dates";
import { formatINR } from "../pricing";
import { quoteStay, searchStay } from "../inventory";
import type { Extracted } from "./extract";

export async function buildQuoteBlock(ex: Extracted): Promise<{ block: string; note?: string }> {
  if (!ex.checkIn || !ex.checkOut) {
    return { block: "", note: "No exact dates yet, so no prices were added." };
  }
  const checkIn = parseIsoDate(ex.checkIn);
  const checkOut = parseIsoDate(ex.checkOut);
  const [types, plan, avail] = await Promise.all([
    prisma.roomType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.ratePlan.findFirst({ where: { active: true, refundable: true }, orderBy: { sortOrder: "asc" } }),
    searchStay(checkIn, checkOut),
  ]);
  if (!plan) return { block: "", note: "No active rate plan; no prices added." };

  const adults = ex.adults ?? (ex.guests && ex.guests <= 4 ? ex.guests : 2);
  const children = ex.children ?? 0;
  const fitting = types.filter(
    (t) =>
      adults <= t.maxAdults &&
      children <= t.maxChildren &&
      adults + children <= t.maxGuests &&
      (!ex.roomPreference || t.category === ex.roomPreference),
  );

  const lines: string[] = [];
  for (const t of fitting) {
    const a = avail.get(t.id);
    if (!a || a.available < 1) continue;
    const q = await quoteStay(t.id, plan.id, checkIn, checkOut);
    if (!q) continue;
    lines.push(`• ${t.name}: ${formatINR(q.grandTotal)} for ${q.nights} night${q.nights > 1 ? "s" : ""}, incl. GST`);
  }
  const header = `${formatRange(checkIn, checkOut)} · ${adults} adult${adults > 1 ? "s" : ""}${children ? `, ${children} child${children > 1 ? "ren" : ""}` : ""} · ${plan.name}`;
  if (lines.length === 0) {
    const what = ex.roomPreference ? `${ex.roomPreference.toLowerCase()}s` : "rooms";
    return {
      block: `We're sorry — our ${what} are fully booked on the website for ${formatRange(checkIn, checkOut)}. We'll check other options and come back to you.`,
      note: "Nothing available on the website allotment for these dates.",
    };
  }
  return { block: [header, ...lines].join("\n") };
}

/** Puts the quote where the AI left [[QUOTE]] (or after the first paragraph). */
export function insertQuote(draft: string, block: string): string {
  if (draft.includes("[[QUOTE]]")) {
    return draft.replace(/\n*\[\[QUOTE\]\]\n*/g, block ? `\n\n${block}\n\n` : "\n\n").trim();
  }
  if (!block) return draft.trim();
  const [first, ...rest] = draft.split(/\n\n/);
  return [first, block, ...rest].join("\n\n").trim();
}
