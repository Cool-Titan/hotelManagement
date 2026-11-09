import type { PriceLine } from "@/lib/pricing";
import { formatINR } from "@/lib/pricing";
import { formatShort, parseIsoDate } from "@/lib/dates";

export function PriceSummary({
  lines,
  roomTotal,
  discountTotal,
  taxTotal,
  grandTotal,
  promoCode,
}: {
  lines: PriceLine[];
  roomTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  promoCode?: string | null;
}) {
  const slabs = [...new Set(lines.map((l) => l.gstRate))];
  return (
    <div className="text-sm">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-ink-2">
          <span>
            {lines.length} night{lines.length > 1 ? "s" : ""} <span className="text-[12px] text-ink-3 underline decoration-dotted group-open:hidden">see each night</span>
          </span>
          <span>{formatINR(roomTotal)}</span>
        </summary>
        <ul className="my-2 space-y-1 rounded-lg bg-paper p-3 text-[12px] text-ink-2">
          {lines.map((l) => (
            <li key={l.date} className="flex justify-between gap-2">
              <span>{formatShort(parseIsoDate(l.date))}</span>
              <span>
                {formatINR(l.planAdjusted)}
                {l.discount ? ` − ${formatINR(l.discount)}` : ""} + {l.gstRate}% GST
              </span>
            </li>
          ))}
        </ul>
      </details>
      {discountTotal > 0 && (
        <div className="flex justify-between py-1 text-estate">
          <span>Promo {promoCode}</span>
          <span>− {formatINR(discountTotal)}</span>
        </div>
      )}
      <div className="flex justify-between py-1 text-ink-2">
        <span>GST ({slabs.map((s) => `${s}%`).join(" / ")})</span>
        <span>{formatINR(taxTotal)}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-medium">Total</span>
        <span className="text-xl font-medium tracking-tight">{formatINR(grandTotal)}</span>
      </div>
    </div>
  );
}
