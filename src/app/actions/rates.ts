"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isIsoDate, parseIsoDate, todayIST, formatShort } from "@/lib/dates";
import { applyInventoryUpdate, InventoryUpdateError } from "@/lib/admin-inventory";

export type RatesState = { ok?: boolean; message?: string; error?: string; conflicts?: string[] } | undefined;

const optInt = (min: number, max: number, msg: string) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int(msg).min(min, msg).max(max, msg).nullable());

const Schema = z.object({
  roomTypeIds: z.array(z.cuid()).min(1, "Choose at least one room type."),
  from: z.string().refine(isIsoDate, "Enter a start date."),
  to: z.string().refine(isIsoDate, "Enter an end date."),
  weekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Choose at least one day of the week."),
  rate: optInt(1000, 200000, "Rate must be between ₹1,000 and ₹2,00,000."),
  allotment: optInt(0, 76, "Allotment must be a whole number of rooms."),
  stopSell: z.enum(["", "on", "off"]),
});

export async function updateInventory(_: RatesState, form: FormData): Promise<RatesState> {
  const user = await assertStaff();
  const parsed = Schema.safeParse({
    roomTypeIds: form.getAll("roomTypeIds"),
    from: form.get("from"),
    to: form.get("to"),
    weekdays: form.getAll("weekdays"),
    rate: form.get("rate"),
    allotment: form.get("allotment"),
    stopSell: form.get("stopSell") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const from = parseIsoDate(d.from);
  if (from < todayIST()) return { error: "Past nights can't be changed." };

  try {
    const r = await applyInventoryUpdate({
      roomTypeIds: d.roomTypeIds,
      from,
      to: parseIsoDate(d.to),
      weekdays: d.weekdays,
      rate: d.rate,
      allotment: d.allotment,
      stopSell: d.stopSell === "" ? null : d.stopSell === "on",
    });
    console.info("inventory update", { by: user.email, ...d, result: { updated: r.updated, created: r.created, conflicts: r.conflicts.length } });
    revalidatePath("/admin/rates");
    revalidatePath("/", "layout");
    const parts = [`Updated ${r.updated} night${r.updated === 1 ? "" : "s"}`];
    if (r.created) parts.push(`loaded ${r.created} new`);
    if (r.missing) parts.push(`${r.missing} skipped because no rate is loaded yet (set both rate and allotment to open them)`);
    return {
      ok: true,
      message: parts.join(", ") + ".",
      conflicts: r.conflicts.map((c) => `${c.roomType}, ${formatShort(parseIsoDate(c.date))}: ${c.booked} already booked`),
    };
  } catch (e) {
    if (e instanceof InventoryUpdateError) return { error: e.message };
    throw e;
  }
}

// --- Blackouts -------------------------------------------------------------

const BlackoutSchema = z.object({
  startDate: z.string().refine(isIsoDate, "Enter a start date."),
  endDate: z.string().refine(isIsoDate, "Enter an end date."),
  reason: z.string().trim().min(3, "Give a short reason.").max(120),
  roomTypeId: z.union([z.literal(""), z.cuid()]),
});

export type SimpleState = { ok?: boolean; error?: string } | undefined;

export async function createBlackout(_: SimpleState, form: FormData): Promise<SimpleState> {
  await assertStaff();
  const p = BlackoutSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const start = parseIsoDate(p.data.startDate);
  const end = parseIsoDate(p.data.endDate);
  if (end < start) return { error: "The end date is before the start date." };
  if (start < todayIST()) return { error: "Blackouts must start today or later." };
  await prisma.blackoutDate.create({ data: { startDate: start, endDate: end, reason: p.data.reason, roomTypeId: p.data.roomTypeId || null } });
  revalidatePath("/admin/blackouts");
  return { ok: true };
}

export async function deleteBlackout(id: string) {
  await assertStaff();
  await prisma.blackoutDate.delete({ where: { id: z.cuid().parse(id) } });
  revalidatePath("/admin/blackouts");
}

// --- Promo codes -----------------------------------------------------------

const PromoSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, "Codes are 3–20 letters, numbers or dashes."),
    description: z.string().trim().min(3, "Add a short description.").max(120),
    type: z.enum(["PERCENT", "FLAT"]),
    value: z.coerce.number().int().min(1, "Enter a discount."),
    minNights: z.coerce.number().int().min(1).max(14),
    validFrom: z.string().refine(isIsoDate, "Enter a start date."),
    validTo: z.string().refine(isIsoDate, "Enter an end date."),
    maxRedemptions: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1).max(10000).nullable()),
  })
  .refine((v) => v.type !== "PERCENT" || v.value <= 50, { message: "Percentage discounts are capped at 50%.", path: ["value"] })
  .refine((v) => v.type !== "FLAT" || v.value <= 50000, { message: "Flat discounts are capped at ₹50,000.", path: ["value"] })
  .refine((v) => v.validTo >= v.validFrom, { message: "The end date is before the start date.", path: ["validTo"] });

export async function createPromo(_: SimpleState, form: FormData): Promise<SimpleState> {
  await assertStaff();
  const p = PromoSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const exists = await prisma.promoCode.findUnique({ where: { code: p.data.code } });
  if (exists) return { error: `${p.data.code} already exists.` };
  await prisma.promoCode.create({
    data: { ...p.data, validFrom: parseIsoDate(p.data.validFrom), validTo: parseIsoDate(p.data.validTo) },
  });
  revalidatePath("/admin/promos");
  return { ok: true };
}

export async function togglePromo(id: string, active: boolean) {
  await assertStaff();
  await prisma.promoCode.update({ where: { id: z.cuid().parse(id) }, data: { active } });
  revalidatePath("/admin/promos");
}
