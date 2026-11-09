import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getVisibleBooking } from "@/lib/bookings";
import { formatRange } from "@/lib/dates";
import type { PriceLine } from "@/lib/pricing";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Steps } from "@/components/site/Steps";
import { PriceSummary } from "@/components/site/PriceSummary";
import { PaymentForm } from "./PaymentForm";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

export default async function PayPage(props: PageProps<"/book/[ref]/pay">) {
  const { ref } = await props.params;
  const b = await getVisibleBooking(ref);
  if (b.status !== "PENDING_PAYMENT") redirect(`/book/${ref}`);

  return (
    <>
      <SiteHeader />
      <div className="container-page py-8 sm:py-12">
        <div className="flex justify-end">
          <Steps current={3} />
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <h1 className="display text-3xl sm:text-4xl">Pay securely</h1>
            <p className="mt-2 flex items-center gap-2 text-ink-2">
              <Lock size={15} aria-hidden /> Test mode — no real money moves.
            </p>
            <PaymentForm reference={b.reference} amount={b.grandTotal} expiresAt={b.holdExpiresAt!.toISOString()} />
          </div>
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="card p-5">
              <p className="eyebrow">Booking {b.reference}</p>
              <p className="mt-2 font-serif text-xl">{b.roomType.name}</p>
              <p className="text-sm text-ink-2">{b.ratePlan.name}</p>
              <p className="mt-3 text-sm">{formatRange(b.checkIn, b.checkOut)}</p>
              <p className="text-sm text-ink-2">
                {b.guestName} · {b.adults} adult{b.adults > 1 ? "s" : ""}
                {b.children ? `, ${b.children} child${b.children > 1 ? "ren" : ""}` : ""}
              </p>
              <div className="mt-4 border-t border-line pt-3">
                <PriceSummary
                  lines={b.priceLines as unknown as PriceLine[]}
                  roomTotal={b.roomTotal}
                  discountTotal={b.discountTotal}
                  taxTotal={b.taxTotal}
                  grandTotal={b.grandTotal}
                  promoCode={b.promoCode?.code}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
