// Staff edits to the rate table and website allotment.
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { addDays, nightsBetween, toIsoDate } from "./dates";

export type InventoryUpdate = {
  roomTypeIds: string[];
  from: Date;
  to: Date; // inclusive
  weekdays: number[]; // ISO: 1 = Monday … 7 = Sunday
  rate?: number | null;
  allotment?: number | null;
  stopSell?: boolean | null;
};

export type UpdateResult = {
  updated: number;
  created: number;
  conflicts: { date: string; roomType: string; booked: number }[];
  missing: number; // nights with no rate loaded and no rate+allotment given to create them
};

export class InventoryUpdateError extends Error {}

const isoDow = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1;

export async function applyInventoryUpdate(u: InventoryUpdate): Promise<UpdateResult> {
  if (u.to < u.from) throw new InventoryUpdateError("The end date is before the start date.");
  if (nightsBetween(u.from, u.to) > 366) throw new InventoryUpdateError("Update at most a year at a time.");
  if (u.rate == null && u.allotment == null && u.stopSell == null) throw new InventoryUpdateError("Nothing to change — set a rate, an allotment or stop-sell.");
  const types = await prisma.roomType.findMany({ where: { id: { in: u.roomTypeIds } } });
  if (types.length !== u.roomTypeIds.length || types.length === 0) throw new InventoryUpdateError("Choose at least one room type.");
  if (u.allotment != null) {
    const over = types.find((t) => u.allotment! > t.totalUnits);
    if (over) throw new InventoryUpdateError(`${over.name} has only ${over.totalUnits} keys — the website allotment can't be higher.`);
  }

  const rate = u.rate ?? null;
  const allot = u.allotment ?? null;
  const stop = u.stopSell ?? null;

  return prisma.$transaction(async (tx) => {
    // One statement; rows where the new allotment would be below rooms
    // already sold or held are left untouched (and reported below).
    const updated = await tx.$executeRaw`
      UPDATE "InventoryDay" SET
        "rate" = COALESCE(${rate}::int, "rate"),
        "allotment" = COALESCE(${allot}::int, "allotment"),
        "stopSell" = COALESCE(${stop}::boolean, "stopSell"),
        "updatedAt" = NOW()
      WHERE "roomTypeId" = ANY(${u.roomTypeIds}::text[])
        AND "date" BETWEEN ${u.from}::date AND ${u.to}::date
        AND EXTRACT(ISODOW FROM "date") = ANY(${u.weekdays}::int[])
        AND (${allot}::int IS NULL OR "sold" + "held" <= ${allot}::int)`;

    const conflicts =
      allot === null
        ? []
        : await tx.$queryRaw<{ date: Date; roomTypeId: string; booked: number }[]>`
          SELECT "date", "roomTypeId", ("sold" + "held")::int AS booked FROM "InventoryDay"
          WHERE "roomTypeId" = ANY(${u.roomTypeIds}::text[])
            AND "date" BETWEEN ${u.from}::date AND ${u.to}::date
            AND EXTRACT(ISODOW FROM "date") = ANY(${u.weekdays}::int[])
            AND "sold" + "held" > ${allot}::int
          ORDER BY "date"`;

    // Nights not loaded yet: create them if we were given both a rate and an allotment.
    const existing = await tx.inventoryDay.findMany({
      where: { roomTypeId: { in: u.roomTypeIds }, date: { gte: u.from, lte: u.to } },
      select: { roomTypeId: true, date: true },
    });
    const have = new Set(existing.map((r) => `${r.roomTypeId}|${toIsoDate(r.date)}`));
    const toCreate: Prisma.InventoryDayCreateManyInput[] = [];
    let missing = 0;
    for (let d = u.from; d <= u.to; d = addDays(d, 1)) {
      if (!u.weekdays.includes(isoDow(d))) continue;
      for (const t of types) {
        if (have.has(`${t.id}|${toIsoDate(d)}`)) continue;
        if (rate !== null && allot !== null) toCreate.push({ roomTypeId: t.id, date: d, rate, allotment: allot, stopSell: stop ?? false });
        else missing++;
      }
    }
    if (toCreate.length) await tx.inventoryDay.createMany({ data: toCreate });

    const names = new Map(types.map((t) => [t.id, t.name]));
    return {
      updated,
      created: toCreate.length,
      conflicts: conflicts.map((c) => ({ date: toIsoDate(c.date), roomType: names.get(c.roomTypeId) ?? "", booked: c.booked })),
      missing,
    };
  });
}

export async function inventoryGrid(from: Date, days: number) {
  const to = addDays(from, days);
  const [types, rows, blackouts] = await Promise.all([
    prisma.roomType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.inventoryDay.findMany({ where: { date: { gte: from, lt: to } } }),
    prisma.blackoutDate.findMany({ where: { startDate: { lt: to }, endDate: { gte: from } } }),
  ]);
  const dates = Array.from({ length: days }, (_, i) => toIsoDate(addDays(from, i)));
  return {
    dates,
    rooms: types.map((t) => {
      const mine = new Map(rows.filter((r) => r.roomTypeId === t.id).map((r) => [toIsoDate(r.date), r]));
      return {
        id: t.id,
        name: t.name,
        totalUnits: t.totalUnits,
        cells: dates.map((iso) => {
          const r = mine.get(iso);
          const d = new Date(`${iso}T00:00:00Z`);
          const blackout = blackouts.find((b) => (b.roomTypeId === null || b.roomTypeId === t.id) && d >= b.startDate && d <= b.endDate);
          return r
            ? { date: iso, rate: r.rate, allotment: r.allotment, sold: r.sold, held: r.held, stopSell: r.stopSell, blackout: blackout?.reason ?? null }
            : { date: iso, rate: null, allotment: null, sold: 0, held: 0, stopSell: false, blackout: blackout?.reason ?? null };
        }),
      };
    }),
  };
}
