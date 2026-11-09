import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { inventoryGrid } from "@/lib/admin-inventory";
import { addDays, isIsoDate, parseIsoDate, todayIST, toIsoDate } from "@/lib/dates";
import { RatesBoard } from "./RatesBoard";

export const metadata: Metadata = { title: "Rates & allotment" };
export const dynamic = "force-dynamic";

const DAYS = 14;

export default async function RatesPage(props: PageProps<"/admin/rates">) {
  await requireStaff();
  const sp = await props.searchParams;
  const today = todayIST();
  const from = typeof sp.from === "string" && isIsoDate(sp.from) && parseIsoDate(sp.from) >= today ? parseIsoDate(sp.from) : today;
  const grid = await inventoryGrid(from, DAYS);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-serif text-3xl">Rates & allotment</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        The website can only sell the allotment set here — the rest of the inventory stays with agencies and the front desk. Allotment can&apos;t be lowered below rooms already sold.
      </p>
      <RatesBoard
        grid={grid}
        today={toIsoDate(today)}
        from={toIsoDate(from)}
        prev={from > today ? toIsoDate(addDays(from, -DAYS) < today ? today : addDays(from, -DAYS)) : null}
        next={toIsoDate(addDays(from, DAYS))}
      />
    </div>
  );
}
