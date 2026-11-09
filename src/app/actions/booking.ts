"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BookingError, confirmBooking, placeHold, releaseHold } from "@/lib/inventory";
import { isIsoDate } from "@/lib/dates";
import { rateLimit } from "@/lib/rate-limit";

export type BookingFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

const DetailsSchema = z.object({
  room: z.string().min(1).max(60),
  plan: z.string().min(1).max(30),
  in: z.string().refine(isIsoDate, "Invalid date"),
  out: z.string().refine(isIsoDate, "Invalid date"),
  adults: z.coerce.number().int().min(1).max(6),
  children: z.coerce.number().int().min(0).max(4),
  name: z.string().trim().min(2, "Enter the lead guest's full name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{8,20}$/, "Enter a phone number with country code, e.g. +91 98450 12345."),
  country: z.string().trim().min(2, "Choose a country.").max(60),
  requests: z.string().trim().max(500, "Keep requests under 500 characters.").optional(),
  promo: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9-]*$/, "Promo codes use letters and numbers only.")
    .optional(),
  consent: z.literal("on", { message: "Please agree so we can process your booking." }),
});

/** Step 2 → 3: validate details and hold the room for HOLD_MINUTES. */
export async function holdRoom(_: BookingFormState, form: FormData): Promise<BookingFormState> {
  const user = await requireUser("/");
  if (!(await rateLimit("hold", 20, 10 * 60_000))) return { error: "Too many attempts. Please wait a few minutes." };

  const raw = Object.fromEntries(form);
  // Echoed back so the form keeps what the guest typed after an error.
  const values = Object.fromEntries(
    ["name", "email", "phone", "country", "requests"].map((k) => [k, String(raw[k] ?? "").slice(0, 500)]),
  );
  const parsed = DetailsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fieldErrors, values };
  }
  const d = parsed.data;
  const [room, plan] = await Promise.all([
    prisma.roomType.findUnique({ where: { slug: d.room } }),
    prisma.ratePlan.findUnique({ where: { code: d.plan } }),
  ]);
  if (!room || !plan) return { error: "That room or rate is no longer available. Please go back and choose again.", values };

  let reference: string;
  try {
    const booking = await placeHold({
      userId: user.id,
      roomTypeId: room.id,
      ratePlanId: plan.id,
      checkIn: d.in,
      checkOut: d.out,
      adults: d.adults,
      children: d.children,
      promoCode: d.promo || null,
      guest: { name: d.name, email: d.email, phone: d.phone, country: d.country, specialRequests: d.requests },
    });
    reference = booking.reference;
  } catch (e) {
    if (e instanceof BookingError) {
      return e.code === "PROMO" ? { error: e.message, fieldErrors: { promo: e.message }, values } : { error: e.message, values };
    }
    console.error("holdRoom failed", e);
    return { error: "Something went wrong on our side. Your card has not been charged. Please try again.", values };
  }
  redirect(`/book/${reference}/pay`);
}

async function ownBooking(reference: string) {
  const user = await requireUser(`/book/${reference}`);
  const booking = await prisma.booking.findUnique({ where: { reference } });
  // Same response for "not yours" and "doesn't exist".
  if (!booking || booking.userId !== user.id) throw new Error("Booking not found");
  return booking;
}

export type PayState = { error?: string } | undefined;

// Test cards, like a payment gateway's sandbox.
const TEST_CARDS: Record<string, "success" | "declined" | "insufficient"> = {
  "4242424242424242": "success",
  "4000000000000002": "declined",
  "4000000000009995": "insufficient",
};

/** Step 3: simulated payment gateway. */
export async function payForBooking(reference: string, _: PayState, form: FormData): Promise<PayState> {
  const booking = await ownBooking(reference);
  if (booking.status === "CONFIRMED") redirect(`/book/${reference}`);
  if (booking.status !== "PENDING_PAYMENT") return { error: "This hold has ended. Please search again." };

  const method = form.get("method");
  let outcome: "success" | "declined" | "insufficient" = "success";
  if (method === "card") {
    const card = String(form.get("card") ?? "").replace(/\D/g, "");
    const expiry = String(form.get("expiry") ?? "");
    const cvc = String(form.get("cvc") ?? "");
    if (!/^\d{2}\s?\/\s?\d{2}$/.test(expiry) || !/^\d{3,4}$/.test(cvc)) return { error: "Check the expiry date (MM/YY) and CVC." };
    if (!(card in TEST_CARDS)) return { error: "This is test mode — use one of the test cards shown below." };
    outcome = TEST_CARDS[card];
  } else if (method === "upi") {
    const vpa = String(form.get("vpa") ?? "");
    if (!/^[\w.-]{2,}@[\w]{2,}$/.test(vpa)) return { error: "Enter a UPI ID like name@okbank." };
    outcome = vpa.startsWith("fail") ? "declined" : "success";
  } else {
    return { error: "Choose a payment method." };
  }

  if (outcome !== "success") {
    // The room stays held until the timer ends so the guest can retry.
    return { error: outcome === "declined" ? "Your bank declined this payment. Try another card or UPI." : "Insufficient funds. Try another card or UPI." };
  }
  try {
    await confirmBooking(booking.id, `pay_test_${crypto.randomUUID().slice(0, 12)}`);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  redirect(`/book/${reference}?paid=1`);
}

export async function abandonBooking(reference: string) {
  const booking = await ownBooking(reference);
  await releaseHold(booking.id, "CANCELLED");
  const room = await prisma.roomType.findUnique({ where: { id: booking.roomTypeId }, select: { slug: true } });
  redirect(`/rooms/${room?.slug ?? ""}`);
}
