import Link from "next/link";
import { ArrowRight, Coffee, ShieldCheck, Undo2 } from "lucide-react";
import { Photo } from "@/components/Photo";
import { SiteHeader } from "@/components/site/SiteHeader";
import { StaySearch } from "@/components/StaySearch";
import { RoomCard, RoomResult } from "@/components/site/RoomCard";
import { fromRates, getOffers, getRoomTypes, todayIso } from "@/lib/catalog";
import { defaultStay, parseStayQuery, stayQueryString } from "@/lib/search";
import { formatRange, parseIsoDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const q = parseStayQuery(sp);
  const denied = sp.denied === "1";
  const searching = Boolean(q.checkIn && q.checkOut);
  const [rooms, from, offers] = await Promise.all([
    getRoomTypes(),
    fromRates(),
    searching ? getOffers({ checkIn: q.checkIn!, checkOut: q.checkOut!, adults: q.adults, children: q.children }) : null,
  ]);
  const initial = { ...defaultStay(), adults: q.adults, children: q.children, ...(searching ? { checkIn: q.checkIn!, checkOut: q.checkOut! } : {}) };

  return (
    <>
      <section className="relative isolate flex min-h-[78svh] flex-col justify-end md:min-h-[86svh]">
        <SiteHeader overlay />
        <Photo src="/images/hero.jpg" alt="Mist over the coffee-covered hills of Chikkamagaluru" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/10 to-black/55" />
        <div className="container-page pb-10 text-white md:pb-16">
          <p className="eyebrow !text-white/80">Chikkamagaluru · Karnataka</p>
          <h1 className="display mt-3 max-w-3xl text-[42px] leading-[1.05] !text-white sm:text-6xl md:text-7xl">
            Stay among the coffee.
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/85">
            Rooms, suites and pool villas on a working estate in the Western Ghats. Book here for our best rate.
          </p>
          <div id="search" className="mt-8 text-ink">
            <StaySearch initial={initial} today={todayIso()} />
          </div>
        </div>
      </section>

      {denied && (
        <div className="container-page mt-6">
          <p role="alert" className="rounded-lg bg-amber-soft px-4 py-3 text-sm text-amber">That page is for resort staff only.</p>
        </div>
      )}

      {q.error && (
        <div className="container-page mt-6">
          <p role="alert" className="rounded-lg bg-cherry-soft px-4 py-3 text-sm text-cherry">{q.error}</p>
        </div>
      )}

      {searching && offers ? (
        <section id="stay" className="container-page py-14 md:py-20" aria-live="polite">
          <p className="eyebrow">Available on our site</p>
          <h2 className="display mt-2 text-3xl sm:text-4xl">
            {formatRange(parseIsoDate(q.checkIn!), parseIsoDate(q.checkOut!))}
          </h2>
          <p className="mt-2 text-ink-2">
            {q.adults} adult{q.adults > 1 ? "s" : ""}
            {q.children ? `, ${q.children} child${q.children > 1 ? "ren" : ""}` : ""} · Prices include GST
          </p>
          <div className="mt-8 grid gap-6">
            {offers
              .sort((a, b) => Number(b.fits && (b.availability?.available ?? 0) > 0) - Number(a.fits && (a.availability?.available ?? 0) > 0))
              .map((o) => (
                <RoomResult key={o.room.id} offer={o} query={stayQueryString(q)} />
              ))}
          </div>
          {offers.every((o) => !o.fits || (o.availability?.available ?? 0) < 1) && (
            <div className="card mt-6 p-6 text-center">
              <p className="font-serif text-xl">Nothing left online for these dates</p>
              <p className="mt-2 text-ink-2">Our team may still be able to help — write to us and we&apos;ll reply within the hour.</p>
              <Link href="/contact" className="btn-secondary mt-4">Send an enquiry</Link>
            </div>
          )}
        </section>
      ) : (
        <section id="stay" className="container-page py-16 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Stay</p>
              <h2 className="display mt-2 text-3xl sm:text-4xl">Three ways to stay on the estate</h2>
            </div>
            <p className="max-w-sm text-ink-2">Per night, room only, before taxes. Choose dates to see your total.</p>
          </div>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r, i) => (
              <RoomCard key={r.id} room={r} fromRate={from.get(r.id)} priority={i === 0} />
            ))}
          </div>
        </section>
      )}

      <section className="border-y border-line bg-surface">
        <div className="container-page grid gap-8 py-10 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Our best rate is here", body: "The price you see is what you pay, GST included." },
            { icon: Undo2, title: "Free cancellation", body: "On flexible rates, up to 72 hours before you arrive." },
            { icon: Coffee, title: "Breakfast with estate coffee", body: "Brewed from beans grown a short walk from your room." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <Icon size={20} className="mt-0.5 shrink-0 text-estate" aria-hidden />
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-ink-2">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)]">
          <Photo src="/images/estate-2.jpg" alt="Ripening coffee cherries on the estate" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
        <div className="md:pl-6">
          <p className="eyebrow">The estate</p>
          <h2 className="display mt-2 text-3xl sm:text-4xl">Slow mornings, mist on the hills, coffee in bloom.</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
            Walk the plantation with our planter, taste this season&apos;s roast, and come back to a quiet room with a view of the
            shade trees. Everything here runs at the pace of the estate.
          </p>
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="container-page grid gap-10 py-16 md:grid-cols-[1fr_1.2fr] md:py-24">
          <div className="flex flex-col justify-center">
            <p className="eyebrow !text-white/60">Celebrations & offsites</p>
            <h2 className="display mt-2 text-3xl !text-white sm:text-4xl">Lawns for weddings. Quiet rooms for big ideas.</h2>
            <p className="mt-5 leading-relaxed text-white/75">
              Tell us about your wedding or team retreat. Our events team replies with options and a proposal.
            </p>
            <Link href="/events" className="btn mt-7 w-fit bg-white text-ink hover:bg-white/90">
              Plan an event <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-card)]">
              <Photo src="/images/wedding.jpg" alt="Wedding aisle on the lawn" fill sizes="(min-width: 768px) 28vw, 50vw" className="object-cover" />
            </div>
            <div className="relative mt-10 aspect-[3/4] overflow-hidden rounded-[var(--radius-card)]">
              <Photo src="/images/offsite.jpg" alt="Sunlit meeting room" fill sizes="(min-width: 768px) 28vw, 50vw" className="object-cover" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
