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

  const adults = ex.adults ?? ex.guests ?? 2;
  const children = ex.children ?? 0;
  const candidates = types.filter((t) => !ex.roomPreference || t.category === ex.roomPreference);

  const lines: string[] = [];
  for (const t of candidates) {
    const rooms = roomsNeeded(t, adults, children);
    if (rooms === null) continue; // too big a group to quote from the website allotment
    const a = avail.get(t.id);
    if (!a || a.available < rooms) continue;
    const q = await quoteStay(t.id, plan.id, checkIn, checkOut);
    if (!q) continue;
    const nights = `${q.nights} night${q.nights > 1 ? "s" : ""}`;
    lines.push(
      rooms === 1
        ? `• ${t.name}: ${formatINR(q.grandTotal)} for ${nights}, incl. GST`
        : `• ${rooms} × ${t.name}: ${formatINR(q.grandTotal * rooms)} for ${nights}, incl. GST (${formatINR(q.grandTotal)} per room)`,
    );
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

/** Rooms of this type a party needs (null if more than a website group of 4 rooms). */
export function roomsNeeded(
  t: { maxAdults: number; maxChildren: number; maxGuests: number },
  adults: number,
  children: number,
): number | null {
  const byAdults = Math.ceil(adults / t.maxAdults);
  const byChildren = children === 0 ? 0 : t.maxChildren === 0 ? Infinity : Math.ceil(children / t.maxChildren);
  const byTotal = Math.ceil((adults + children) / t.maxGuests);
  const n = Math.max(1, byAdults, byChildren, byTotal);
  return n <= 4 ? n : null;
}

const tidy = (s: string) =>
  s
    .split(/\n{2,}/)
    .map((p) => p.split("\n").map((l) => l.trim()).join("\n").trim())
    .filter(Boolean)
    .join("\n\n");

/** Puts the quote where the AI left [[QUOTE]] (or after the first paragraph). */
export function insertQuote(draft: string, block: string): string {
  if (draft.includes("[[QUOTE]]")) {
    return tidy(draft.replace(/\s*\[\[QUOTE\]\]\s*/g, block ? `\n\n${block}\n\n` : "\n\n"));
  }
  if (!block) return tidy(draft);
  const [first, ...rest] = tidy(draft).split(/\n\n/);
  return [first, block, ...rest].join("\n\n");
}
