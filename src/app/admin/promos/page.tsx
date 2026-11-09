import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatShort, todayIST, toIsoDate } from "@/lib/dates";
import { formatINR } from "@/lib/pricing";
import { togglePromo } from "@/app/actions/rates";
import { PromoForm } from "./PromoForm";

export const metadata: Metadata = { title: "Promo codes" };
export const dynamic = "force-dynamic";

export default async function PromosPage() {
  await requireStaff();
  const today = todayIST();
  const promos = await prisma.promoCode.findMany({ orderBy: [{ active: "desc" }, { validTo: "desc" }] });
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-serif text-3xl">Promo codes</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">Discounts apply to the room rate before GST. A code counts as used while a guest is paying, and is released if they don&apos;t finish.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line text-left text-[12px] text-ink-3">
              <tr>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Discount</th>
                <th className="px-3 py-3 font-medium">Stay dates</th>
                <th className="px-3 py-3 font-medium">Used</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {promos.map((p) => {
                const expired = p.validTo < today;
                const exhausted = p.maxRedemptions !== null && p.redemptions >= p.maxRedemptions;
                return (
                  <tr key={p.id} className={!p.active || expired ? "text-ink-3" : ""}>
                    <td className="px-5 py-3">
                      <span className="font-mono font-medium">{p.code}</span>
                      <span className="block text-[12px] text-ink-3">{p.description}</span>
                    </td>
                    <td className="px-3 py-3">
                      {p.type === "PERCENT" ? `${p.value}%` : formatINR(p.value)}
                      {p.minNights > 1 && <span className="block text-[12px] text-ink-3">{p.minNights}+ nights</span>}
                    </td>
                    <td className="px-3 py-3">{formatShort(p.validFrom)} – {formatShort(p.validTo)}</td>
                    <td className="px-3 py-3">
                      {p.redemptions}
                      {p.maxRedemptions !== null && ` / ${p.maxRedemptions}`}
                      {exhausted && <span className="chip ml-2 bg-paper text-ink-2">full</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {expired ? (
                        <span className="text-[12px]">ended</span>
                      ) : (
                        <form action={togglePromo.bind(null, p.id, !p.active)}>
                          <button className="btn-ghost btn-sm">{p.active ? "Pause" : "Activate"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {promos.length === 0 && <p className="p-10 text-center text-sm text-ink-2">No promo codes yet.</p>}
        </section>
        <PromoForm today={toIsoDate(today)} />
      </div>
    </div>
  );
}
