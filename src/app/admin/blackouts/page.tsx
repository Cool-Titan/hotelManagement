import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatLong, todayIST, toIsoDate } from "@/lib/dates";
import { deleteBlackout } from "@/app/actions/rates";
import { BlackoutForm } from "./BlackoutForm";

export const metadata: Metadata = { title: "Blackout dates" };
export const dynamic = "force-dynamic";

export default async function BlackoutsPage() {
  await requireStaff();
  const today = todayIST();
  const [items, rooms] = await Promise.all([
    prisma.blackoutDate.findMany({ where: { endDate: { gte: today } }, include: { roomType: { select: { name: true } } }, orderBy: { startDate: "asc" } }),
    prisma.roomType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-serif text-3xl">Blackout dates</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">Close the website for a buy-out, maintenance or a festival you&apos;d rather sell by phone. Existing bookings are not affected.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card overflow-hidden">
          {items.length === 0 ? (
            <p className="p-10 text-center text-sm text-ink-2">No upcoming blackouts — every allotted night is on sale.</p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-medium">{b.reason}</p>
                    <p className="text-sm text-ink-2">
                      {formatLong(b.startDate)} → {formatLong(b.endDate)} · {b.roomType?.name ?? "Whole property"}
                    </p>
                  </div>
                  <form action={deleteBlackout.bind(null, b.id)}>
                    <button className="btn-ghost btn-sm !px-2" aria-label={`Remove blackout: ${b.reason}`}>
                      <Trash2 size={16} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
        <BlackoutForm rooms={rooms} today={toIsoDate(today)} />
      </div>
    </div>
  );
}
