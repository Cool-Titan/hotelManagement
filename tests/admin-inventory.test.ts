import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { addDays, todayIST } from "../src/lib/dates";
import { applyInventoryUpdate, InventoryUpdateError } from "../src/lib/admin-inventory";

const today = todayIST();
let roomId = "";

beforeEach(async () => {
  await prisma.$transaction([
    prisma.booking.deleteMany(),
    prisma.inventoryDay.deleteMany(),
    prisma.blackoutDate.deleteMany(),
    prisma.promoCode.deleteMany(),
    prisma.ratePlan.deleteMany(),
    prisma.roomType.deleteMany(),
  ]);
  const rt = await prisma.roomType.create({
    data: { slug: "r", name: "Plantation Room", tagline: "", description: "", category: "ROOM", sizeSqm: 30, bed: "", view: "", maxAdults: 2, maxChildren: 1, maxGuests: 3, totalUnits: 40, baseRate: 7000 },
  });
  roomId = rt.id;
  await prisma.inventoryDay.createMany({
    data: Array.from({ length: 7 }, (_, i) => ({ roomTypeId: rt.id, date: addDays(today, i), rate: 7000, allotment: 10, sold: i === 2 ? 6 : 0 })),
  });
});
afterAll(() => prisma.$disconnect());

const all = [1, 2, 3, 4, 5, 6, 7];

describe("applyInventoryUpdate", () => {
  it("updates rate only, keeping allotments", async () => {
    const r = await applyInventoryUpdate({ roomTypeIds: [roomId], from: today, to: addDays(today, 6), weekdays: all, rate: 8200 });
    expect(r.updated).toBe(7);
    const rows = await prisma.inventoryDay.findMany({ where: { roomTypeId: roomId } });
    expect(rows.every((x) => x.rate === 8200 && x.allotment === 10)).toBe(true);
  });

  it("never lowers allotment below rooms already sold, and reports those nights", async () => {
    const r = await applyInventoryUpdate({ roomTypeIds: [roomId], from: today, to: addDays(today, 6), weekdays: all, allotment: 4 });
    expect(r.updated).toBe(6);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].booked).toBe(6);
    const night = await prisma.inventoryDay.findFirstOrThrow({ where: { roomTypeId: roomId, date: addDays(today, 2) } });
    expect(night.allotment).toBe(10);
  });

  it("refuses an allotment above the physical keys", async () => {
    await expect(applyInventoryUpdate({ roomTypeIds: [roomId], from: today, to: today, weekdays: all, allotment: 41 })).rejects.toBeInstanceOf(InventoryUpdateError);
  });

  it("only touches the chosen weekdays", async () => {
    await applyInventoryUpdate({ roomTypeIds: [roomId], from: today, to: addDays(today, 6), weekdays: [6, 7], stopSell: true });
    const rows = await prisma.inventoryDay.findMany({ where: { roomTypeId: roomId } });
    for (const x of rows) {
      const dow = ((x.date.getUTCDay() + 6) % 7) + 1;
      expect(x.stopSell).toBe(dow >= 6);
    }
  });

  it("opens new nights only when given both a rate and an allotment", async () => {
    const r1 = await applyInventoryUpdate({ roomTypeIds: [roomId], from: addDays(today, 7), to: addDays(today, 8), weekdays: all, rate: 9000 });
    expect(r1).toMatchObject({ created: 0, missing: 2 });
    const r2 = await applyInventoryUpdate({ roomTypeIds: [roomId], from: addDays(today, 7), to: addDays(today, 8), weekdays: all, rate: 9000, allotment: 5 });
    expect(r2.created).toBe(2);
  });

  it("rejects empty updates and reversed ranges", async () => {
    await expect(applyInventoryUpdate({ roomTypeIds: [roomId], from: today, to: today, weekdays: all })).rejects.toThrow(/Nothing to change/);
    await expect(applyInventoryUpdate({ roomTypeIds: [roomId], from: addDays(today, 2), to: today, weekdays: all, rate: 9000 })).rejects.toThrow(/before/);
  });
});
