import Link from "next/link";
import type { Metadata } from "next";
import type { BookingStatus, Prisma } from "@prisma/client";
import { Download } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime, formatShort, todayIST, toIsoDate } from "@/lib/dates";
import { formatINR } from "@/lib/pricing";
import { releaseExpiredHolds } from "@/lib/inventory";
import { cancelBooking } from "@/app/actions/admin-bookings";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; where: Prisma.BookingWhereInput }[] = [
  { key: "upcoming", label: "Upcoming stays", where: { status: "CONFIRMED" } },
  { key: "recent", label: "Booked recently", where: { status: { in: ["CONFIRMED", "CANCELLED"] } } },
  { key: "pending", label: "Awaiting payment", where: { status: "PENDING_PAYMENT" } },
  { key: "lost", label: "Expired / failed", where: { status: { in: ["EXPIRED", "PAYMENT_FAILED"] } } },
];

const STATUS_TONE: Record<BookingStatus, string> = {
  CONFIRMED: "bg-estate-soft text-estate",
  PENDING_PAYMENT: "bg-amber-soft text-amber",
  EXPIRED: "bg-paper text-ink-3",
  PAYMENT_FAILED: "bg-cherry-soft text-cherry",
  CANCELLED: "bg-paper text-ink-2",
};

export default async function BookingsPage(props: PageProps<"/admin/bookings">) {
  const user = await requireStaff();
  await releaseExpiredHolds();
  const sp = await props.searchParams;
  const f = FILTERS.find((x) => x.key === sp.view) ?? FILTERS[0];
  const today = todayIST();
  const where: Prisma.BookingWhereInput = { ...f.where, ...(f.key === "upcoming" ? { checkOut: { gte: today } } : {}) };
  const [bookings, todayCount] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { roomType: { select: { name: true } }, ratePlan: { select: { name: true } } },
      orderBy: f.key === "upcoming" ? { checkIn: "asc" } : { createdAt: "desc" },
      take: 100,
    }),
    prisma.booking.count({ where: { status: "CONFIRMED", paidAt: { gte: new Date(today.getTime() - 330 * 60_000) } } }),
  ]);
  const isoToday = toIsoDate(today);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Bookings</h1>
          <p className="mt-1 text-sm text-ink-2">Website bookings. {todayCount} confirmed today.</p>
        </div>
        <form action="/api/export/bookings" method="get" className="flex items-end gap-2">
          <label className="block">
            <span className="label">Export day</span>
            <input type="date" name="date" defaultValue={isoToday} max={isoToday} className="input h-9 text-sm" />
          </label>
          <button className="btn-primary btn-sm">
            <Download size={15} aria-hidden /> CSV for reservation system
          </button>
        </form>
      </div>

      <nav className="-mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Filter">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={`?view=${x.key}`}
            aria-current={x.key === f.key ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap ${x.key === f.key ? "border-estate font-medium" : "border-transparent text-ink-2 hover:text-ink"}`}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {bookings.length === 0 ? (
        <p className="card mt-4 p-10 text-center text-sm text-ink-2">No bookings here.</p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line text-left text-[12px] text-ink-3">
              <tr>
                <th className="px-5 py-3 font-medium">Guest</th>
                <th className="px-3 py-3 font-medium">Stay</th>
                <th className="px-3 py-3 font-medium">Room · rate</th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-3">
                    <Link href={`/book/${b.reference}`} className="font-medium hover:underline">{b.guestName}</Link>
                    <span className="block font-mono text-[11px] text-ink-3">{b.reference} · {formatDateTime(b.createdAt)}</span>
                  </td>
                  <td className="px-3 py-3">
                    {formatShort(b.checkIn)} – {formatShort(b.checkOut)}
                    <span className="block text-[12px] text-ink-3">{b.nights} night{b.nights > 1 ? "s" : ""} · {b.adults + b.children} guests</span>
                  </td>
                  <td className="px-3 py-3">
                    {b.roomType.name}
                    <span className="block text-[12px] text-ink-3">{b.ratePlan.name}</span>
                  </td>
                  <td className="px-3 py-3 text-right">{formatINR(b.grandTotal)}</td>
                  <td className="px-3 py-3">
                    <span className={`chip ${STATUS_TONE[b.status]}`}>{b.status.replace("_", " ").toLowerCase()}</span>
                    {b.exportedAt && <span className="block text-[11px] text-ink-3">exported</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {b.status === "CONFIRMED" && b.checkIn >= today && user.role === "GM" && (
                      <form action={cancelBooking.bind(null, b.id)}>
                        <button className="btn-ghost btn-sm text-cherry">Cancel</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
