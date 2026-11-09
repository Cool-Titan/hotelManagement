import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Write to us" };

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <div className="container-page grid max-w-5xl gap-12 py-12 md:grid-cols-[1fr_1.3fr] md:py-20">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">Write to us.</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
            A question about a stay, a special request, or something that didn&apos;t go right — it reaches the right person on our
            team, and we reply within working hours.
          </p>
          <p className="mt-6 text-sm text-ink-2">
            Planning a wedding or offsite? The <Link href="/events" className="underline">event enquiry form</Link> gets you a proposal faster.
          </p>
        </div>
        <ContactForm />
      </div>
    </>
  );
}
