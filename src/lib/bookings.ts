import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "./db";
import { requireUser } from "./auth";
import { isStaffRole } from "./session";
import { releaseExpiredHolds } from "./inventory";

/** Loads a booking the signed-in user may see (their own, or any for staff). */
export async function getVisibleBooking(reference: string) {
  const user = await requireUser(`/book/${reference}`);
  await releaseExpiredHolds();
  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { roomType: true, ratePlan: true, promoCode: { select: { code: true } } },
  });
  if (!booking || (booking.userId !== user.id && !isStaffRole(user.role))) notFound();
  return booking;
}
