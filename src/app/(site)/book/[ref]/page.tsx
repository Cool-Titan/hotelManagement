import Link from "next/link";
import type { Metadata } from "next";
import { CalendarCheck, CircleAlert, CircleCheck, Clock } from "lucide-react";
import { getVisibleBooking } from "@/lib/bookings";
import { formatDateTime, formatLong } from "@/lib/dates";
import type { PriceLine } from "@/lib/pricing";
import { SiteHeader } from "@/components/site/SiteHeader";
import { PriceSummary } from "@/components/site/PriceSummary";
import { Photo } from "@/components/Photo";

export const metadata: Metadata = { title: "Your booking" };
export const dynamic = "force-dynamic";

export default async function BookingPage(props: PageProps<"/book/[ref]">) {
  const { ref } = await props.params;
  const b = await getVisibleBooking(ref);
  const confirmed = b.status === "CONFIRMED";

  const banner = {
    CONFIRMED: { icon: CircleCheck, tone: "text-estate", title: "You're booked.", body: `Keep this page for your records. In this demo, confirmation emails to ${b.guestEmail} are simulated.` },
    PENDING_PAYMENT: { icon: Clock, tone: "text-amber", title: "Awaiting payment", body: "Your room is held while you complete payment." },
    EXPIRED: { icon: CircleAlert, tone: "text-amber", title: "This hold has ended", body: "Payment wasn't completed in time, so the room was released. You have not been charged." },
    PAYMENT_FAILED: { icon: CircleAlert, tone: "text-cherry", title: "Payment didn't go through", body: "You have not been charged. The room has been released." },
    CANCELLED: { icon: CircleAlert, tone: "text-ink-2", title: "Booking cancelled", body: "This booking has been cancelled." },
  }[b.status];
  const Icon = banner.icon;

  return (
    <>
      <SiteHeader />
      <div className="container-page max-w-4xl py-10 sm:py-14">
        <div className="text-center">
          <Icon size={36} className={`mx-auto ${banner.tone}`} aria-hidden />
          <h1 className="display mt-4 text-4xl sm:text-5xl">{banner.title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-ink-2">{banner.body}</p>
          {b.status === "PENDING_PAYMENT" && <Link href={`/book/${b.reference}/pay`} className="btn-primary mt-6">Complete payment</Link>}
          {(b.status === "EXPIRED" || b.status === "PAYMENT_FAILED" || b.status === "CANCELLED") && (
            <Link href={`/rooms/${b.roomType.slug}`} className="btn-primary mt-6">Search again</Link>
          )}
        </div>

        <div className="card mt-10 grid overflow-hidden md:grid-cols-[280px_1fr]">
          <div className="relative aspect-[16/9] md:aspect-auto">
            <Photo src={b.roomType.images[0]} alt={b.roomType.name} fill sizes="(min-width: 768px) 280px, 100vw" className="object-cover" />
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-serif text-2xl">{b.roomType.name}</p>
              <p className="font-mono text-sm text-ink-2">{b.reference}</p>
            </div>
            <p className="text-sm text-ink-2">{b.ratePlan.name}</p>

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-3">Check-in</dt>
                <dd className="mt-0.5 font-medium">{formatLong(b.checkIn)} · from 2 pm</dd>
              </div>
              <div>
                <dt className="text-ink-3">Check-out</dt>
                <dd className="mt-0.5 font-medium">{formatLong(b.checkOut)} · by 11 am</dd>
              </div>
              <div>
                <dt className="text-ink-3">Guests</dt>
                <dd className="mt-0.5">
                  {b.guestName} · {b.adults} adult{b.adults > 1 ? "s" : ""}
                  {b.children ? `, ${b.children} child${b.children > 1 ? "ren" : ""}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">{confirmed ? "Paid" : "Status"}</dt>
                <dd className="mt-0.5">{confirmed && b.paidAt ? `${formatDateTime(b.paidAt)} · test payment ${b.paymentRef}` : b.status.replace("_", " ").toLowerCase()}</dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-line pt-4">
              <PriceSummary
                lines={b.priceLines as unknown as PriceLine[]}
                roomTotal={b.roomTotal}
                discountTotal={b.discountTotal}
                taxTotal={b.taxTotal}
                grandTotal={b.grandTotal}
                promoCode={b.promoCode?.code}
              />
            </div>
            <p className="mt-4 text-[13px] text-ink-2">{b.ratePlan.cancellationPolicy}</p>
          </div>
        </div>

        {confirmed && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="card flex gap-3 p-5 text-sm">
              <CalendarCheck size={18} className="shrink-0 text-estate" aria-hidden />
              <p className="text-ink-2">
                <span className="font-medium text-ink">Getting here.</span> Our team will message you before arrival with directions and to arrange a pick-up if you need one.
              </p>
            </div>
            <div className="card flex gap-3 p-5 text-sm">
              <CircleAlert size={18} className="shrink-0 text-ink-3" aria-hidden />
              <p className="text-ink-2">
                <span className="font-medium text-ink">At check-in</span> please carry a photo ID. Guests on foreign passports complete Form C at the front desk.
              </p>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-sm">
          <Link href="/account" className="text-ink-2 underline hover:text-ink">See all my trips</Link>
        </p>
      </div>
    </>
  );
}
