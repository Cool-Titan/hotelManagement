import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = { title: "Privacy & your data" };

export default function PrivacyPage() {
  const sections = [
    {
      h: "What we collect",
      p: "For a booking: the lead guest's name, email, mobile number, country of residence, party size and any requests you write. For an enquiry: your name, contact details and message. We do not collect passport or ID numbers online — foreign guests complete Form C with our front desk at check-in.",
    },
    {
      h: "Why we use it",
      p: "Only to manage your booking or answer your enquiry, and to send it to our reservation system. We ask for your consent each time you book or write to us, and we record when you gave it.",
    },
    {
      h: "Who sees it",
      p: "Our reservations, events and management staff, each signed in with their own account. Enquiries may be read by an automated assistant that suggests a category and a draft reply; a person always reviews and sends the reply.",
    },
    {
      h: "Payments",
      p: "Card and UPI details go to the payment provider, not to us. This demo site uses test-mode payments only.",
    },
    {
      h: "Your rights",
      p: "Under the Digital Personal Data Protection Act, 2023, you can ask to see, correct or erase your data, or withdraw consent, by writing to us through the contact page. We'll respond within the time the law sets.",
    },
  ];
  return (
    <>
      <SiteHeader />
      <article className="container-page max-w-2xl py-12 sm:py-20">
        <p className="eyebrow">Privacy</p>
        <h1 className="display mt-2 text-4xl">How we use your data</h1>
        <p className="mt-4 text-ink-2">A plain-language summary. (Demo site — no real guest data is stored.)</p>
        {sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="font-serif text-xl">{s.h}</h2>
            <p className="mt-2 leading-relaxed text-ink-2">{s.p}</p>
          </section>
        ))}
      </article>
    </>
  );
}
