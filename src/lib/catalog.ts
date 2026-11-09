// Read models for the guest site: room types with live offers for a stay.
import "server-only";
import type { RatePlan, RoomType } from "@prisma/client";
import { prisma } from "./db";
import { addDays, parseIsoDate, todayIST, toIsoDate } from "./dates";
import { releaseExpiredHolds, searchStay, type StayAvailability } from "./inventory";
import { priceStay, type Quote } from "./pricing";

export type PlanOffer = { plan: RatePlan; quote: Quote | null; reason?: string };
export type RoomOffer = {
  room: RoomType;
  fits: boolean;
  availability: StayAvailability | null;
  plans: PlanOffer[];
  best: PlanOffer | null;
};

export async function getRoomTypes() {
  return prisma.roomType.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getActivePlans() {
  return prisma.ratePlan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

export function fitsParty(room: RoomType, adults: number, children: number) {
  return adults <= room.maxAdults && children <= room.maxChildren && adults + children <= room.maxGuests;
}

/** Lowest room-only rate over the next 60 days, for "from ₹…" labels. */
export async function fromRates(): Promise<Map<string, number>> {
  const today = todayIST();
  const rows = await prisma.inventoryDay.groupBy({
    by: ["roomTypeId"],
    where: { date: { gte: today, lt: addDays(today, 60) }, stopSell: false },
    _min: { rate: true },
  });
  return new Map(rows.map((r) => [r.roomTypeId, r._min.rate ?? 0]));
}

export async function getOffers(q: { checkIn: string; checkOut: string; adults: number; children: number }, onlyRoomId?: string): Promise<RoomOffer[]> {
  await releaseExpiredHolds();
  const checkIn = parseIsoDate(q.checkIn);
  const checkOut = parseIsoDate(q.checkOut);
  const [rooms, plans, avail] = await Promise.all([
    onlyRoomId ? prisma.roomType.findMany({ where: { id: onlyRoomId } }) : getRoomTypes(),
    getActivePlans(),
    searchStay(checkIn, checkOut),
  ]);
  return rooms.map((room) => {
    const a = avail.get(room.id) ?? null;
    const fits = fitsParty(room, q.adults, q.children);
    const offers: PlanOffer[] = plans.map((plan) => {
      if (!a || a.available < 1) return { plan, quote: null, reason: "unavailable" };
      if (a.nights.length < plan.minNights) return { plan, quote: null, reason: `Minimum ${plan.minNights} nights` };
      return { plan, quote: priceStay(a.nights.map((n) => ({ date: n.date, rate: n.rate })), plan) };
    });
    const priced = offers.filter((o) => o.quote);
    const best = priced.length ? priced.reduce((m, o) => (o.quote!.grandTotal < m.quote!.grandTotal ? o : m)) : null;
    return { room, fits, availability: a, plans: offers, best };
  });
}

export function todayIso() {
  return toIsoDate(todayIST());
}
