import Link from "next/link";
import { BedDouble, Maximize2, Users } from "lucide-react";
import { Photo } from "@/components/Photo";
import { formatINR } from "@/lib/pricing";
import type { RoomOffer } from "@/lib/catalog";
import type { RoomType } from "@prisma/client";

export function RoomFacts({ room }: { room: RoomType }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      <li className="inline-flex items-center gap-1.5"><Maximize2 size={13} aria-hidden /> {room.sizeSqm} m²</li>
      <li className="inline-flex items-center gap-1.5"><BedDouble size={14} aria-hidden /> {room.bed}</li>
      <li className="inline-flex items-center gap-1.5"><Users size={14} aria-hidden /> Up to {room.maxGuests} guests</li>
    </ul>
  );
}

/** Card for browsing (no dates) — shows the "from" price. */
export function RoomCard({ room, fromRate, priority = false }: { room: RoomType; fromRate?: number; priority?: boolean }) {
  return (
    <Link href={`/rooms/${room.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-line">
        <Photo
          src={room.images[0]}
          alt={`${room.name} at Kaapi Estate`}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h3 className="font-serif text-2xl">{room.name}</h3>
        {fromRate ? (
          <p className="shrink-0 text-sm text-ink-2">
            from <span className="font-medium text-ink">{formatINR(fromRate)}</span>
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-[15px] text-ink-2">{room.tagline}</p>
      <div className="mt-3"><RoomFacts room={room} /></div>
    </Link>
  );
}

/** Result row for a dated search — availability and the best total price. */
export function RoomResult({ offer, query }: { offer: RoomOffer; query: string }) {
  const { room, availability, best, fits } = offer;
  const left = availability?.available ?? 0;
  const bookable = fits && left > 0 && best?.quote;
  return (
    <article className="card grid overflow-hidden md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="relative aspect-[16/10] md:aspect-auto md:min-h-64">
        <Photo src={room.images[0]} alt={room.name} fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
      </div>
      <div className="flex flex-col gap-4 p-5 sm:p-7">
        <div>
          <h3 className="font-serif text-2xl">{room.name}</h3>
          <p className="mt-1 text-[15px] text-ink-2">{room.tagline}</p>
        </div>
        <RoomFacts room={room} />
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
          {!fits ? (
            <p className="text-sm text-ink-2">Sleeps up to {room.maxAdults} adults and {room.maxChildren} {room.maxChildren === 1 ? "child" : "children"}. For bigger groups, book separately or <Link className="underline" href="/contact">write to us</Link>.</p>
          ) : left < 1 ? (
            <p className="text-sm text-ink-2">
              {availability?.reason === "CLOSED" ? "Not available online for some of these nights." : "Sold out for these dates."} Try nearby dates.
            </p>
          ) : (
            <div>
              <p className="text-[13px] text-ink-3">{best!.quote!.nights} night{best!.quote!.nights > 1 ? "s" : ""} · {best!.plan.name} · incl. GST</p>
              <p className="text-2xl font-medium tracking-tight">{formatINR(best!.quote!.grandTotal)}</p>
              {left <= 2 && <p className="mt-1 text-[13px] font-medium text-cherry">Only {left} left on our site</p>}
            </div>
          )}
          <Link href={`/rooms/${room.slug}?${query}`} className={bookable ? "btn-primary" : "btn-secondary"}>
            {bookable ? "Choose rate" : "See calendar"}
          </Link>
        </div>
      </div>
    </article>
  );
}
