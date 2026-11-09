import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRange, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/pricing";
import { releaseExpiredHolds } from "@/lib/inventory";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Photo } from "@/components/Photo";

export const metadata: Metadata = { title: "My trips" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: "Confirmed", cls: "bg-estate-soft text-estate" },
  PENDING_PAYMENT: { label: "Awaiting payment", cls: "bg-amber-soft text-amber" },
  EXPIRED: { label: "Hold expired", cls: "bg-paper text-ink-2" },
  PAYMENT_FAILED: { label: "Payment failed", cls: "bg-cherry-soft text-cherry" },
  CANCELLED: { label: "Cancelled", cls: "bg-paper text-ink-2" },
};

export default async function AccountPage() {
  const user = await requireUser("/account");
  await releaseExpiredHolds();
  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    include: { roomType: { select: { name: true, images: true } } },
    orderBy: { checkIn: "desc" },
  });
  const today = todayIST();
  const upcoming = bookings.filter((b) => b.checkOut >= today && b.status !== "EXPIRED" && b.status !== "CANCELLED" && b.status !== "PAYMENT_FAILED").reverse();
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <>
      <SiteHeader />
      <div className="container-page max-w-4xl py-10 sm:py-14">
        <p className="eyebrow">Signed in as {user.email}</p>
        <h1 className="display mt-2 text-4xl">Hello, {user.name.split(" ")[0]}</h1>

        <h2 className="mt-10 font-serif text-2xl">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="card mt-4 p-8 text-center">
            <p className="font-serif text-xl">No trips planned yet</p>
            <p className="mt-1 text-ink-2">The mist is lovely this time of year.</p>
            <Link href="/#search" className="btn-primary mt-5">Find dates</Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">{upcoming.map((b) => <Trip key={b.id} b={b} />)}</ul>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mt-12 font-serif text-2xl">Past and cancelled</h2>
            <ul className="mt-4 space-y-4">{past.map((b) => <Trip key={b.id} b={b} muted />)}</ul>
          </>
        )}
      </div>
    </>
  );
}

function Trip({ b, muted = false }: { b: { reference: string; status: string; checkIn: Date; checkOut: Date; grandTotal: number; roomType: { name: string; images: string[] } }; muted?: boolean }) {
  const s = STATUS[b.status];
  return (
    <li>
      <Link href={`/book/${b.reference}`} className={`card flex items-center gap-4 p-3 transition-colors hover:border-line-2 ${muted ? "opacity-75" : ""}`}>
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg sm:w-32">
          <Photo src={b.roomType.images[0]} alt="" fill sizes="128px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{b.roomType.name}</p>
          <p className="text-sm text-ink-2">{formatRange(b.checkIn, b.checkOut)}</p>
          <p className="mt-1 font-mono text-[12px] text-ink-3">{b.reference}</p>
        </div>
        <div className="hidden text-right sm:block">
          <span className={`chip ${s.cls}`}>{s.label}</span>
          <p className="mt-2 text-sm">{formatINR(b.grandTotal)}</p>
        </div>
      </Link>
    </li>
  );
}
