// Integration tests against a real Postgres (DATABASE_URL from .env.test).
// These prove the "never overbook" guarantee under concurrency.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { addDays, todayIST, toIsoDate } from "../src/lib/dates";
import { BookingError, confirmBooking, placeHold, releaseExpiredHolds, releaseHold, searchStay, cancelConfirmed } from "../src/lib/inventory";

const today = todayIST();
const d = (n: number) => toIsoDate(addDays(today, n));
let roomTypeId = "";
let planId = "";
let userId = "";

async function reset(allotment: number) {
  await prisma.$transaction([
    prisma.booking.deleteMany(),
    prisma.inventoryDay.deleteMany(),
    prisma.blackoutDate.deleteMany(),
    prisma.promoCode.deleteMany(),
    prisma.ratePlan.deleteMany(),
    prisma.roomType.deleteMany(),
    prisma.enquiryEvent.deleteMany(),
    prisma.enquiry.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  const user = await prisma.user.create({ data: { email: "t@test", name: "Test", passwordHash: "x" } });
  const rt = await prisma.roomType.create({
    data: {
      slug: "villa", name: "Villa", tagline: "", description: "", category: "VILLA", sizeSqm: 100, bed: "King", view: "",
      maxAdults: 2, maxChildren: 1, maxGuests: 3, totalUnits: 12, baseRate: 18000,
    },
  });
  const plan = await prisma.ratePlan.create({
    data: { code: "BB", name: "B&B", description: "", supplementPerNight: 900, cancellationPolicy: "" },
  });
  await prisma.inventoryDay.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({ roomTypeId: rt.id, date: addDays(today, i), rate: 18000, allotment })),
  });
  roomTypeId = rt.id;
  planId = plan.id;
  userId = user.id;
}

const hold = (checkIn: string, checkOut: string, extra: Partial<Parameters<typeof placeHold>[0]> = {}) =>
  placeHold({
    userId, roomTypeId, ratePlanId: planId, checkIn, checkOut, adults: 2, children: 0,
    guest: { name: "G", email: "g@example.com", phone: "+91 9000000000", country: "India" },
    ...extra,
  });

beforeEach(() => reset(1));
afterAll(() => prisma.$disconnect());

describe("allotment control", () => {
  it("sells the last room to exactly one of 20 simultaneous guests", async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => hold(d(2), d(4))));
    const ok = results.filter((r) => r.status === "fulfilled");
    const soldOut = results.filter((r) => r.status === "rejected" && (r.reason as BookingError).code === "SOLD_OUT");
    expect(ok).toHaveLength(1);
    expect(soldOut).toHaveLength(19);
    const rows = await prisma.inventoryDay.findMany({ where: { roomTypeId, held: { gt: 0 } } });
    expect(rows.map((r) => r.held)).toEqual([1, 1]);
  });

  it("handles overlapping stays racing for the same night", async () => {
    await reset(2);
    // Night d(3) is shared by every request; only 2 can win it.
    const stays: [string, string][] = [[d(1), d(4)], [d(3), d(5)], [d(2), d(4)], [d(3), d(4)], [d(0), d(6)]];
    const results = await Promise.allSettled(stays.map(([a, b]) => hold(a, b)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const night = await prisma.inventoryDay.findFirstOrThrow({ where: { roomTypeId, date: addDays(today, 3) } });
    expect(night.held).toBe(2);
    const all = await prisma.inventoryDay.findMany({ where: { roomTypeId } });
    expect(all.every((r) => r.sold + r.held <= r.allotment)).toBe(true);
  });

  it("rolls back every night when one night is full", async () => {
    await hold(d(3), d(4));
    await expect(hold(d(2), d(5))).rejects.toMatchObject({ code: "SOLD_OUT" });
    const nights = await prisma.inventoryDay.findMany({ where: { roomTypeId }, orderBy: { date: "asc" } });
    expect(nights.map((n) => n.held).slice(0, 6)).toEqual([0, 0, 0, 1, 0, 0]);
  });

  it("the database refuses an overbooking write even if the app tried one", async () => {
    await expect(
      prisma.inventoryDay.updateMany({ where: { roomTypeId }, data: { sold: { increment: 2 } } }),
    ).rejects.toThrow(/InventoryDay_counters_check|check constraint/i);
  });

  it("confirms a held room into a sold one", async () => {
    const b = await hold(d(2), d(4));
    await confirmBooking(b.id, "pay_test_1");
    const nights = await prisma.inventoryDay.findMany({ where: { roomTypeId, date: { in: [addDays(today, 2), addDays(today, 3)] } } });
    expect(nights.map((n) => [n.sold, n.held])).toEqual([[1, 0], [1, 0]]);
    expect((await searchStay(addDays(today, 2), addDays(today, 4))).get(roomTypeId)?.available).toBe(0);
  });

  it("releases the room when payment fails, and payment can't succeed after that", async () => {
    const b = await hold(d(2), d(4));
    expect(await releaseHold(b.id, "PAYMENT_FAILED")).toBe(true);
    expect(await releaseHold(b.id, "PAYMENT_FAILED")).toBe(false); // idempotent
    await expect(confirmBooking(b.id, "late")).rejects.toMatchObject({ code: "EXPIRED" });
    expect((await searchStay(addDays(today, 2), addDays(today, 4))).get(roomTypeId)?.available).toBe(1);
  });

  it("expires lapsed holds so abandoned checkouts don't block the room", async () => {
    const b = await hold(d(2), d(4));
    const later = new Date(Date.now() + 16 * 60_000);
    expect(await releaseExpiredHolds(later)).toBe(1);
    await expect(confirmBooking(b.id, "late", later)).rejects.toMatchObject({ code: "EXPIRED" });
    await expect(hold(d(2), d(4))).resolves.toBeTruthy();
  });

  it("a confirm racing an expiry adjusts the counters exactly once", async () => {
    const b = await hold(d(2), d(4));
    const atExpiry = new Date(Date.now() + 14 * 60_000);
    await Promise.allSettled([confirmBooking(b.id, "p", atExpiry), releaseHold(b.id, "EXPIRED")]);
    const night = await prisma.inventoryDay.findFirstOrThrow({ where: { roomTypeId, date: addDays(today, 2) } });
    expect(night.sold + night.held).toBeLessThanOrEqual(1);
    expect(night.held).toBe(0);
  });

  it("frees the room again when staff cancel a confirmed booking", async () => {
    const b = await hold(d(2), d(4));
    await confirmBooking(b.id, "p");
    expect(await cancelConfirmed(b.id)).toBe(true);
    await expect(hold(d(2), d(4))).resolves.toBeTruthy();
  });

  it("does not sell blacked-out or stop-sell nights", async () => {
    await prisma.blackoutDate.create({ data: { startDate: addDays(today, 5), endDate: addDays(today, 5), reason: "Buy-out" } });
    await expect(hold(d(4), d(6))).rejects.toMatchObject({ code: "CLOSED" });
    await prisma.inventoryDay.updateMany({ where: { roomTypeId, date: addDays(today, 7) }, data: { stopSell: true } });
    await expect(hold(d(7), d(8))).rejects.toMatchObject({ code: "SOLD_OUT" });
  });

  it("does not sell nights that have no rate loaded", async () => {
    await expect(hold(d(9), d(11))).rejects.toMatchObject({ code: "SOLD_OUT" });
  });

  it("validates occupancy and stay length", async () => {
    await expect(hold(d(1), d(2), { adults: 3 })).rejects.toMatchObject({ code: "INVALID" });
    await expect(hold(d(2), d(2))).rejects.toMatchObject({ code: "INVALID" });
  });

  it("never lets a capped promo code be over-redeemed", async () => {
    await reset(5);
    await prisma.promoCode.create({
      data: { code: "ONE", description: "", type: "PERCENT", value: 10, validFrom: today, validTo: addDays(today, 30), maxRedemptions: 1 },
    });
    const results = await Promise.allSettled([hold(d(1), d(2), { promoCode: "one" }), hold(d(1), d(2), { promoCode: "ONE" }), hold(d(1), d(2), { promoCode: "ONE" })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    // Rooms claimed by the losing requests were rolled back with them.
    const night = await prisma.inventoryDay.findFirstOrThrow({ where: { roomTypeId, date: addDays(today, 1) } });
    expect(night.held).toBe(1);
  });

  it("snapshots the price with GST at hold time", async () => {
    const b = await hold(d(1), d(3));
    // 18,000 + 900 = 18,900 per night → 18% slab
    expect(b.roomTotal).toBe(37800);
    expect(b.taxTotal).toBe(Math.round(18900 * 0.18) * 2);
  });
});
