import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOffers } from "@/lib/catalog";
import { parseStayQuery, stayQueryString } from "@/lib/search";
import { parseIsoDate, formatRange, nightsBetween } from "@/lib/dates";
import { priceStay, promoProblem } from "@/lib/pricing";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Steps } from "@/components/site/Steps";
import { Photo } from "@/components/Photo";
import { PriceSummary } from "@/components/site/PriceSummary";
import { BookingForm } from "./BookingForm";

export const metadata: Metadata = { title: "Your details" };
export const dynamic = "force-dynamic";

export default async function BookPage(props: PageProps<"/book">) {
  const sp = await props.searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? "";
  const q = parseStayQuery(sp);
  const slug = one("room");
  const planCode = one("plan");
  const promoInput = one("promo").trim().toUpperCase().slice(0, 20);

  const here = `/book?${new URLSearchParams({ room: slug, plan: planCode, ...(q.checkIn ? { in: q.checkIn, out: q.checkOut! } : {}), adults: String(q.adults), children: String(q.children) })}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}&reason=book`);

  const [room, plan] = await Promise.all([
    prisma.roomType.findUnique({ where: { slug } }),
    prisma.ratePlan.findUnique({ where: { code: planCode } }),
  ]);

  const backHref = room ? `/rooms/${room.slug}?${stayQueryString(q)}#rates` : "/";
  const problem =
    !room || !plan || !plan.active ? "That room or rate isn't available any more." : q.error ? q.error : !q.checkIn ? "Choose your dates first." : null;

  let offer = null;
  if (!problem) {
    [offer] = await getOffers({ checkIn: q.checkIn!, checkOut: q.checkOut!, adults: q.adults, children: q.children }, room!.id);
  }
  const planOffer = offer?.plans.find((p) => p.plan.id === plan?.id);
  const unavailable = !problem && (!offer?.fits || !planOffer?.quote);

  // Optional promo preview (re-validated when the hold is placed).
  let quote = planOffer?.quote ?? null;
  let promoMessage: string | null = null;
  if (quote && promoInput && offer?.availability) {
    const promo = await prisma.promoCode.findUnique({ where: { code: promoInput } });
    const checkIn = parseIsoDate(q.checkIn!);
    const checkOut = parseIsoDate(q.checkOut!);
    const why = promo ? promoProblem(promo, checkIn, checkOut, nightsBetween(checkIn, checkOut)) : "That promo code doesn't exist.";
    if (promo && !why) {
      quote = priceStay(offer.availability.nights.map((n) => ({ date: n.date, rate: n.rate })), plan!, { code: promo.code, type: promo.type, value: promo.value });
      promoMessage = `${promo.code} applied — ${promo.description}`;
    } else {
      promoMessage = why;
    }
  }

  return (
    <>
      <SiteHeader />
      <div className="container-page py-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <ChevronLeft size={16} aria-hidden /> Back
          </Link>
          <Steps current={2} />
        </div>

        {problem || unavailable ? (
          <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
            <h1 className="font-serif text-2xl">{problem ? "Let's start again" : "No longer available"}</h1>
            <p className="mt-2 text-ink-2">
              {problem ?? (offer?.fits ? "Someone booked the last room for these dates, or the rate has closed." : "This room doesn't fit your party.")}
            </p>
            <Link href={backHref} className="btn-primary mt-6">Choose dates</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
            <div>
              <h1 className="display text-3xl sm:text-4xl">Who&apos;s staying?</h1>
              <p className="mt-2 text-ink-2">We&apos;ll hold the room for 15 minutes while you pay.</p>
              <BookingForm
                hidden={{ room: room!.slug, plan: plan!.code, in: q.checkIn!, out: q.checkOut!, adults: String(q.adults), children: String(q.children) }}
                defaults={{ name: user.name, email: user.email, phone: user.phone ?? "" }}
                promo={{ value: promoInput, message: promoMessage, ok: Boolean(promoMessage && quote?.promoCode) }}
              />
            </div>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="card overflow-hidden">
                <div className="relative aspect-[16/9]">
                  <Photo src={room!.images[0]} alt={room!.name} fill sizes="380px" className="object-cover" />
                </div>
                <div className="p-5">
                  <p className="font-serif text-xl">{room!.name}</p>
                  <p className="mt-0.5 text-sm text-ink-2">{plan!.name}</p>
                  <p className="mt-3 text-sm">
                    {formatRange(parseIsoDate(q.checkIn!), parseIsoDate(q.checkOut!))}
                    <br />
                    <span className="text-ink-2">
                      {q.adults} adult{q.adults > 1 ? "s" : ""}
                      {q.children ? `, ${q.children} child${q.children > 1 ? "ren" : ""}` : ""}
                    </span>
                  </p>
                  <div className="mt-4 border-t border-line pt-3">
                    <PriceSummary {...quote!} />
                  </div>
                  <p className="mt-4 text-[12px] leading-relaxed text-ink-3">{plan!.cancellationPolicy}</p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
