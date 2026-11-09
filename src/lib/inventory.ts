// Allotment control: the website may only sell what reservations staff have
// allotted to it, and must never overbook.
//
// How the guarantee works:
//  1. Every night of every room type has one InventoryDay row with
//     `allotment`, `sold` and `held` counters.
//  2. A checkout claims a room with ONE conditional UPDATE over all nights of
//     the stay: it only increments `held` on rows where `sold + held < allotment`.
//     Postgres locks each row it updates and re-checks the condition after any
//     concurrent writer commits, so two guests can never both take the last
//     room. If fewer rows were updated than there are nights, the transaction
//     rolls back and nothing is held.
//  3. A CHECK constraint (sold + held <= allotment) in the database is the
//     backstop — even a bug in this file cannot overbook.
//  4. Holds expire after HOLD_MINUTES. Payment confirmation and expiry both
//     flip the booking status with a conditional update, so exactly one of
//     them adjusts the counters.

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { addDays, nightsBetween, parseIsoDate, toIsoDate } from "./dates";
import { priceStay, promoProblem, type Quote } from "./pricing";
import { randomReference } from "./ids";

import { HOLD_MINUTES, MAX_NIGHTS } from "./stay-limits";
export { HOLD_MINUTES, MAX_NIGHTS };

export class BookingError extends Error {
  constructor(
    public code: "SOLD_OUT" | "CLOSED" | "INVALID" | "PROMO" | "EXPIRED" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

export type NightAvailability = {
  date: string;
  rate: number;
  available: number;
  closed: boolean;
};

/** Blackout ranges that touch any night in [from, to). */
async function blackoutsFor(db: Tx | typeof prisma, from: Date, to: Date) {
  return db.blackoutDate.findMany({
    where: { startDate: { lt: to }, endDate: { gte: from } },
  });
}

function isBlackedOut(
  blackouts: { startDate: Date; endDate: Date; roomTypeId: string | null }[],
  roomTypeId: string,
  night: Date,
) {
  return blackouts.some(
    (b) => (b.roomTypeId === null || b.roomTypeId === roomTypeId) && night >= b.startDate && night <= b.endDate,
  );
}

/** Night-by-night availability for one room type (used by the calendar). */
export async function roomCalendar(roomTypeId: string, from: Date, days: number): Promise<NightAvailability[]> {
  const to = addDays(from, days);
  const [rows, blackouts] = await Promise.all([
    prisma.inventoryDay.findMany({
      where: { roomTypeId, date: { gte: from, lt: to } },
      orderBy: { date: "asc" },
    }),
    blackoutsFor(prisma, from, to),
  ]);
  const byDate = new Map(rows.map((r) => [toIsoDate(r.date), r]));
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    const iso = toIsoDate(d);
    const row = byDate.get(iso);
    const closed = !row || row.stopSell || isBlackedOut(blackouts, roomTypeId, d);
    return {
      date: iso,
      rate: row?.rate ?? 0,
      available: closed || !row ? 0 : Math.max(0, row.allotment - row.sold - row.held),
      closed,
    };
  });
}

export type StayAvailability = {
  roomTypeId: string;
  available: number; // rooms free for every night of the stay
  nights: NightAvailability[];
  reason?: "SOLD_OUT" | "CLOSED";
};

/** Availability of every room type for a stay. */
export async function searchStay(checkIn: Date, checkOut: Date): Promise<Map<string, StayAvailability>> {
  const n = nightsBetween(checkIn, checkOut);
  const [types, rows, blackouts] = await Promise.all([
    prisma.roomType.findMany({ select: { id: true } }),
    prisma.inventoryDay.findMany({ where: { date: { gte: checkIn, lt: checkOut } } }),
    blackoutsFor(prisma, checkIn, checkOut),
  ]);
  const result = new Map<string, StayAvailability>();
  for (const { id } of types) {
    const mine = new Map(rows.filter((r) => r.roomTypeId === id).map((r) => [toIsoDate(r.date), r]));
    const nights: NightAvailability[] = [];
    for (let i = 0; i < n; i++) {
      const d = addDays(checkIn, i);
      const iso = toIsoDate(d);
      const row = mine.get(iso);
      const closed = !row || row.stopSell || isBlackedOut(blackouts, id, d);
      nights.push({
        date: iso,
        rate: row?.rate ?? 0,
        available: closed || !row ? 0 : Math.max(0, row.allotment - row.sold - row.held),
        closed,
      });
    }
    const available = nights.length ? Math.min(...nights.map((x) => x.available)) : 0;
    result.set(id, {
      roomTypeId: id,
      available,
      nights,
      reason: available > 0 ? undefined : nights.some((x) => x.closed) ? "CLOSED" : "SOLD_OUT",
    });
  }
  return result;
}

export type HoldInput = {
  userId: string;
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  promoCode?: string | null;
  guest: { name: string; email: string; phone: string; country: string; specialRequests?: string | null };
};

/**
 * Claims one room for every night of the stay and creates a booking awaiting
 * payment. Throws BookingError if the room cannot be sold.
 */
export async function placeHold(input: HoldInput, now: Date = new Date()) {
  const checkIn = parseIsoDate(input.checkIn);
  const checkOut = parseIsoDate(input.checkOut);
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1 || nights > MAX_NIGHTS) throw new BookingError("INVALID", `Stays can be 1 to ${MAX_NIGHTS} nights.`);

  await releaseExpiredHolds(now);

  return prisma.$transaction(
    async (tx) => {
      const [roomType, plan] = await Promise.all([
        tx.roomType.findUnique({ where: { id: input.roomTypeId } }),
        tx.ratePlan.findUnique({ where: { id: input.ratePlanId } }),
      ]);
      if (!roomType) throw new BookingError("NOT_FOUND", "That room type no longer exists.");
      if (!plan || !plan.active) throw new BookingError("INVALID", "That rate plan is not available.");
      if (nights < plan.minNights) throw new BookingError("INVALID", `${plan.name} needs at least ${plan.minNights} nights.`);
      if (input.adults < 1 || input.adults > roomType.maxAdults || input.children > roomType.maxChildren)
        throw new BookingError("INVALID", `${roomType.name} sleeps up to ${roomType.maxAdults} adults and ${roomType.maxChildren} children.`);
      if (input.adults + input.children > roomType.maxGuests)
        throw new BookingError("INVALID", `${roomType.name} sleeps up to ${roomType.maxGuests} guests.`);

      const blackouts = await blackoutsFor(tx, checkIn, checkOut);
      for (let i = 0; i < nights; i++) {
        if (isBlackedOut(blackouts, roomType.id, addDays(checkIn, i)))
          throw new BookingError("CLOSED", "The resort isn't taking website bookings on some of these dates.");
      }

      // The atomic claim. See the comment at the top of this file.
      const claimed = await tx.$executeRaw`
        UPDATE "InventoryDay"
        SET "held" = "held" + 1, "updatedAt" = NOW()
        WHERE "roomTypeId" = ${roomType.id}
          AND "date" >= ${checkIn}::date AND "date" < ${checkOut}::date
          AND "stopSell" = false
          AND "sold" + "held" + 1 <= "allotment"`;
      if (claimed !== nights) {
        throw new BookingError("SOLD_OUT", `Sorry — ${roomType.name} just sold out for these dates.`);
      }

      const rows = await tx.inventoryDay.findMany({
        where: { roomTypeId: roomType.id, date: { gte: checkIn, lt: checkOut } },
        orderBy: { date: "asc" },
      });

      let promo = null;
      if (input.promoCode) {
        const code = input.promoCode.trim().toUpperCase();
        promo = await tx.promoCode.findUnique({ where: { code } });
        if (!promo) throw new BookingError("PROMO", "That promo code doesn't exist.");
        const problem = promoProblem(promo, checkIn, checkOut, nights);
        if (problem) throw new BookingError("PROMO", problem);
        // Count the redemption now, conditionally, so a capped code can't be over-used.
        const ok = await tx.$executeRaw`
          UPDATE "PromoCode" SET "redemptions" = "redemptions" + 1
          WHERE "id" = ${promo.id} AND ("maxRedemptions" IS NULL OR "redemptions" < "maxRedemptions")`;
        if (ok !== 1) throw new BookingError("PROMO", "This code has been fully redeemed.");
      }

      const quote = priceStay(
        rows.map((r) => ({ date: toIsoDate(r.date), rate: r.rate })),
        plan,
        promo ? { code: promo.code, type: promo.type, value: promo.value } : null,
      );

      return tx.booking.create({
        data: {
          reference: randomReference("KE"),
          userId: input.userId,
          roomTypeId: roomType.id,
          ratePlanId: plan.id,
          promoCodeId: promo?.id,
          checkIn,
          checkOut,
          nights,
          adults: input.adults,
          children: input.children,
          guestName: input.guest.name,
          guestEmail: input.guest.email,
          guestPhone: input.guest.phone,
          guestCountry: input.guest.country,
          specialRequests: input.guest.specialRequests || null,
          roomTotal: quote.roomTotal,
          discountTotal: quote.discountTotal,
          taxTotal: quote.taxTotal,
          grandTotal: quote.grandTotal,
          priceLines: quote.lines,
          holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
          consentAt: now,
        },
      });
    },
    { timeout: 15_000 },
  );
}

/** Turns a held room into a sold room. Fails if the hold already lapsed. */
export async function confirmBooking(bookingId: string, paymentRef: string, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const flipped = await tx.booking.updateMany({
      where: { id: bookingId, status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
      data: { status: "CONFIRMED", paymentRef, paidAt: now, holdExpiresAt: null },
    });
    if (flipped.count !== 1) throw new BookingError("EXPIRED", "This booking's hold has expired. Please search again.");
    const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    await tx.$executeRaw`
      UPDATE "InventoryDay" SET "held" = "held" - 1, "sold" = "sold" + 1, "updatedAt" = NOW()
      WHERE "roomTypeId" = ${b.roomTypeId} AND "date" >= ${b.checkIn}::date AND "date" < ${b.checkOut}::date`;
    return b;
  });
}

/** Gives a held room back (payment failed, guest abandoned, or hold expired). */
export async function releaseHold(
  bookingId: string,
  status: "PAYMENT_FAILED" | "EXPIRED" | "CANCELLED",
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const flipped = await tx.booking.updateMany({
      where: { id: bookingId, status: "PENDING_PAYMENT" },
      data: { status, holdExpiresAt: null },
    });
    if (flipped.count !== 1) return false; // already confirmed or released
    const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    await tx.$executeRaw`
      UPDATE "InventoryDay" SET "held" = "held" - 1, "updatedAt" = NOW()
      WHERE "roomTypeId" = ${b.roomTypeId} AND "date" >= ${b.checkIn}::date AND "date" < ${b.checkOut}::date`;
    if (b.promoCodeId) {
      await tx.$executeRaw`UPDATE "PromoCode" SET "redemptions" = "redemptions" - 1 WHERE "id" = ${b.promoCodeId} AND "redemptions" > 0`;
    }
    return true;
  });
}

/** Staff cancellation of a confirmed booking: frees the room for resale. */
export async function cancelConfirmed(bookingId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const flipped = await tx.booking.updateMany({
      where: { id: bookingId, status: "CONFIRMED" },
      data: { status: "CANCELLED" },
    });
    if (flipped.count !== 1) return false;
    const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    await tx.$executeRaw`
      UPDATE "InventoryDay" SET "sold" = "sold" - 1, "updatedAt" = NOW()
      WHERE "roomTypeId" = ${b.roomTypeId} AND "date" >= ${b.checkIn}::date AND "date" < ${b.checkOut}::date`;
    return true;
  });
}

/** Lazily expires lapsed holds; called before every search and checkout. */
export async function releaseExpiredHolds(now: Date = new Date()): Promise<number> {
  const lapsed = await prisma.booking.findMany({
    where: { status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } },
    select: { id: true },
    take: 100,
  });
  let released = 0;
  for (const { id } of lapsed) if (await releaseHold(id, "EXPIRED")) released++;
  return released;
}

/** Price a stay from the rate table without holding anything (for quotes). */
export async function quoteStay(roomTypeId: string, ratePlanId: string, checkIn: Date, checkOut: Date): Promise<Quote | null> {
  const [rows, plan] = await Promise.all([
    prisma.inventoryDay.findMany({
      where: { roomTypeId, date: { gte: checkIn, lt: checkOut } },
      orderBy: { date: "asc" },
    }),
    prisma.ratePlan.findUnique({ where: { id: ratePlanId } }),
  ]);
  const n = nightsBetween(checkIn, checkOut);
  if (!plan || n < 1 || rows.length !== n) return null;
  return priceStay(
    rows.map((r) => ({ date: toIsoDate(r.date), rate: r.rate })),
    plan,
  );
}
