import type { Metadata } from "next";
import { Photo } from "@/components/Photo";
import { SiteHeader } from "@/components/site/SiteHeader";
import { todayIso } from "@/lib/catalog";
import { EventForm } from "./EventForm";

export const metadata: Metadata = { title: "Weddings & offsites", description: "Plan a wedding or corporate offsite on a coffee estate in Chikkamagaluru." };

export default function EventsPage() {
  return (
    <>
      <SiteHeader />
      <section className="container-page grid gap-10 py-10 md:grid-cols-2 md:py-16">
        <div className="flex flex-col justify-center">
          <p className="eyebrow">Weddings & offsites</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">Gather on the estate.</h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">
            Our lawns host weddings under the shade trees and team retreats away from the city. Share a few details and our
            events team will reply with options, availability and a proposal.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-card)]">
            <Photo src="/images/wedding.jpg" alt="Wedding aisle on the lawn" fill priority sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
          </div>
          <div className="relative mt-8 aspect-[3/4] overflow-hidden rounded-[var(--radius-card)]">
            <Photo src="/images/offsite.jpg" alt="Meeting room with garden views" fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
          </div>
        </div>
      </section>
      <section className="container-page max-w-3xl pb-20">
        <EventForm today={todayIso()} />
      </section>
    </>
  );
}
