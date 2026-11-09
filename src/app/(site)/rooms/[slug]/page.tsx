import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check, ChevronLeft, Info } from "lucide-react";
import { prisma } from "@/lib/db";
import { Photo } from "@/components/Photo";
import { SiteHeader } from "@/components/site/SiteHeader";
import { RoomFacts } from "@/components/site/RoomCard";
import { AvailabilityCalendar } from "@/components/site/AvailabilityCalendar";
import { getOffers, fitsParty } from "@/lib/catalog";
import { roomCalendar } from "@/lib/inventory";
import { parseStayQuery, stayQueryString } from "@/lib/search";
import { formatINR } from "@/lib/pricing";
import { formatRange, parseIsoDate, todayIST } from "@/lib/dates";
import { MAX_NIGHTS } from "@/lib/stay-limits";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/rooms/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const room = await prisma.roomType.findUnique({ where: { slug }, select: { name: true, tagline: true } });
  return room ? { title: room.name, description: room.tagline } : {};
}

export default async function RoomPage(props: PageProps<"/rooms/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const room = await prisma.roomType.findUnique({ where: { slug } });
  if (!room) notFound();

  const q = parseStayQuery(sp);
  const dated = Boolean(q.checkIn && q.checkOut);
  const [calendar, offers] = await Promise.all([
    roomCalendar(room.id, todayIST(), 180),
    dated ? getOffers({ checkIn: q.checkIn!, checkOut: q.checkOut!, adults: q.adults, children: q.children }, room.id) : null,
  ]);
  const offer = offers?.[0];
  const fits = fitsParty(room, q.adults, q.children);
  const available = offer?.availability?.available ?? 0;

  return (
    <>
      <SiteHeader />
      <div className="container-page pt-6">
        <Link href={`/?${stayQueryString(q)}#stay`} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
          <ChevronLeft size={16} aria-hidden /> All rooms
        </Link>
      </div>

      <section className="container-page mt-4 grid gap-3 md:grid-cols-[2fr_1fr] md:grid-rows-2" aria-label="Photos">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] md:row-span-2 md:aspect-auto md:min-h-[460px]">
          <Photo src={room.images[0]} alt={`${room.name}`} fill priority sizes="(min-width: 768px) 66vw, 100vw" className="object-cover" />
        </div>
        {room.images.slice(1, 3).map((src, i) => (
          <div key={src} className="relative hidden aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] md:block md:aspect-auto">
            <Photo src={src} alt={`${room.name}, view ${i + 2}`} fill sizes="33vw" className="object-cover" />
          </div>
        ))}
      </section>

      <div className="container-page grid gap-12 py-10 lg:grid-cols-[1fr_380px] lg:py-14">
        <div className="min-w-0">
          <p className="eyebrow">{room.view} view</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">{room.name}</h1>
          <p className="mt-2 text-lg text-ink-2">{room.tagline}</p>
          <div className="mt-5"><RoomFacts room={room} /></div>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-2">{room.description}</p>
          <ul className="mt-6 grid max-w-xl grid-cols-1 gap-2 text-[15px] sm:grid-cols-2">
            {room.amenities.map((a) => (
              <li key={a} className="flex items-center gap-2"><Check size={15} className="text-estate" aria-hidden /> {a}</li>
            ))}
          </ul>

          <section className="mt-12" aria-labelledby="cal">
            <h2 id="cal" className="font-serif text-2xl">Availability</h2>
            <div className="card mt-4 p-4 sm:p-6">
              <AvailabilityCalendar
                key={`${q.checkIn}-${q.checkOut}`}
                nights={calendar}
                checkIn={q.checkIn}
                checkOut={q.checkOut}
                adults={q.adults}
                childCount={q.children}
                maxNights={MAX_NIGHTS}
              />
            </div>
          </section>
        </div>

        <aside id="rates" className="lg:sticky lg:top-6 lg:self-start" aria-labelledby="rates-h">
          <div className="card p-5 sm:p-6">
            <h2 id="rates-h" className="font-serif text-2xl">Your stay</h2>
            {q.error && <p role="alert" className="mt-3 rounded-lg bg-cherry-soft px-3 py-2 text-sm text-cherry">{q.error}</p>}
            {!dated ? (
              <p className="mt-3 text-ink-2">Choose your dates in the calendar to see rates and the total with GST.</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink-2">
                  {formatRange(parseIsoDate(q.checkIn!), parseIsoDate(q.checkOut!))} · {q.adults} adult{q.adults > 1 ? "s" : ""}
                  {q.children ? `, ${q.children} child${q.children > 1 ? "ren" : ""}` : ""}
                </p>
                {!fits ? (
                  <p className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
                    The {room.name} sleeps up to {room.maxAdults} adults and {room.maxChildren} {room.maxChildren === 1 ? "child" : "children"} ({room.maxGuests} guests).
                  </p>
                ) : available < 1 ? (
                  <p className="mt-4 rounded-lg bg-paper px-3 py-3 text-sm text-ink-2">
                    {offer?.availability?.reason === "CLOSED"
                      ? "We aren't taking online bookings for some of these nights."
                      : "Sold out for these dates."}{" "}
                    Pick other dates, or <Link href="/contact" className="underline">ask our team</Link>.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {offer!.plans.map(({ plan, quote, reason }) => (
                      <li key={plan.id} className={`rounded-xl border p-4 ${quote ? "border-line-2" : "border-line opacity-60"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{plan.name}</p>
                            <p className="mt-0.5 text-[13px] text-ink-2">{plan.description}</p>
                          </div>
                          {quote && (
                            <div className="shrink-0 text-right">
                              <p className="text-lg font-medium">{formatINR(quote.grandTotal)}</p>
                              <p className="text-[11px] text-ink-3">incl. {formatINR(quote.taxTotal)} GST</p>
                            </div>
                          )}
                        </div>
                        <ul className="mt-2 space-y-0.5 text-[12px] text-ink-2">
                          {plan.inclusions.map((inc) => <li key={inc}>· {inc}</li>)}
                        </ul>
                        {quote ? (
                          <Link
                            href={`/book?${new URLSearchParams({ room: room.slug, plan: plan.code, in: q.checkIn!, out: q.checkOut!, adults: String(q.adults), children: String(q.children) })}`}
                            className="btn-primary btn-sm mt-3 w-full"
                          >
                            Book this rate
                          </Link>
                        ) : (
                          <p className="mt-2 text-[12px] text-ink-3">{reason}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {available > 0 && available <= 2 && fits && (
                  <p className="mt-3 text-[13px] font-medium text-cherry">Only {available} left on our site for these dates</p>
                )}
              </>
            )}
            <p className="mt-5 flex gap-2 text-[12px] leading-relaxed text-ink-3">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              GST is charged per night at the slab for that night&apos;s tariff (5% up to ₹7,500, 18% above).
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
