import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addDays, isIsoDate, parseIsoDate, todayIST, toIsoDate } from "@/lib/dates";
import { isStaffRole } from "@/lib/session";
import { toCsv, type ExportRow } from "@/lib/export";

// GET /api/export/bookings?date=YYYY-MM-DD
// Bookings confirmed or cancelled on that day (IST), for the reservation system.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date") ?? toIsoDate(todayIST());
  if (!isIsoDate(dateParam)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  // IST day → UTC window
  const start = new Date(parseIsoDate(dateParam).getTime() - 330 * 60_000);
  const end = new Date(addDays(parseIsoDate(dateParam), 1).getTime() - 330 * 60_000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "CANCELLED"] },
      OR: [{ paidAt: { gte: start, lt: end } }, { status: "CANCELLED", updatedAt: { gte: start, lt: end } }],
    },
    include: { roomType: { select: { name: true } }, ratePlan: { select: { code: true } }, promoCode: { select: { code: true } } },
    orderBy: { createdAt: "asc" },
  });

  const ist = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16).replace("T", " ") : null);
  const rows: ExportRow[] = bookings.map((b) => ({
    reference: b.reference,
    status: b.status,
    booked_at_ist: ist(b.paidAt ?? b.createdAt),
    check_in: toIsoDate(b.checkIn),
    check_out: toIsoDate(b.checkOut),
    nights: b.nights,
    room_type: b.roomType.name,
    rate_plan: b.ratePlan.code,
    adults: b.adults,
    children: b.children,
    guest_name: b.guestName,
    guest_email: b.guestEmail,
    guest_phone: b.guestPhone,
    guest_country: b.guestCountry,
    room_total_inr: b.roomTotal,
    discount_inr: b.discountTotal,
    gst_inr: b.taxTotal,
    grand_total_inr: b.grandTotal,
    promo_code: b.promoCode?.code ?? null,
    payment_ref: b.paymentRef,
    special_requests: b.specialRequests,
    source: b.source,
  }));

  if (bookings.length) {
    await prisma.booking.updateMany({ where: { id: { in: bookings.map((b) => b.id) }, exportedAt: null }, data: { exportedAt: new Date() } });
  }
  console.info("booking export", { by: user.email, date: dateParam, rows: rows.length });

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kaapi-bookings-${dateParam}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
