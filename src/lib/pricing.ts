// Pure price calculation. Everything a guest pays is computed here from the
// rate table — the same function prices the booking flow and the quotes that
// are inserted into AI reply drafts, so the AI never invents a price.

/**
 * GST on hotel accommodation (ASSUMPTION — labelled in the TDD): slabs per the
 * GST rate rationalisation effective 22 Sep 2025, applied per room per night
 * on the value actually charged for that night:
 *   ≤ ₹1,000        → 0%
 *   ₹1,001 – 7,500  → 5%
 *   > ₹7,500        → 18%
 */
export function gstRateFor(nightlyValue: number): number {
  if (nightlyValue <= 1000) return 0;
  if (nightlyValue <= 7500) return 5;
  return 18;
}

export type PlanInput = {
  supplementPerNight: number;
  discountPct: number;
};

export type PromoInput = {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
};

export type NightInput = { date: string; rate: number };

export type PriceLine = {
  date: string;
  roomRate: number; // room-only rate from the rate table
  planAdjusted: number; // after rate-plan discount + supplement
  discount: number; // promo discount for this night
  taxable: number; // what GST is charged on
  gstRate: number;
  gst: number;
  total: number;
};

export type Quote = {
  lines: PriceLine[];
  nights: number;
  roomTotal: number; // sum of planAdjusted
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  promoCode?: string;
};

/**
 * Prices a stay. A flat promo is spread across nights proportionally so that
 * each night is taxed on what is really charged for it.
 */
export function priceStay(nights: NightInput[], plan: PlanInput, promo?: PromoInput | null): Quote {
  if (nights.length === 0) throw new Error("A stay needs at least one night");

  const adjusted = nights.map((n) => {
    const afterPlanDiscount = Math.round(n.rate * (1 - plan.discountPct / 100));
    return afterPlanDiscount + plan.supplementPerNight;
  });
  const roomTotal = adjusted.reduce((a, b) => a + b, 0);

  let discounts = adjusted.map(() => 0);
  if (promo) {
    if (promo.type === "PERCENT") {
      const pct = Math.min(Math.max(promo.value, 0), 100);
      discounts = adjusted.map((v) => Math.round((v * pct) / 100));
    } else {
      const flat = Math.min(Math.max(promo.value, 0), roomTotal);
      // Proportional split; the last night absorbs rounding so the sum is exact.
      let remaining = flat;
      discounts = adjusted.map((v, i) => {
        if (i === adjusted.length - 1) return remaining;
        const share = Math.round((flat * v) / roomTotal);
        remaining -= share;
        return share;
      });
    }
  }

  const lines: PriceLine[] = nights.map((n, i) => {
    const taxable = adjusted[i] - discounts[i];
    const gstRate = gstRateFor(taxable);
    const gst = Math.round((taxable * gstRate) / 100);
    return {
      date: n.date,
      roomRate: n.rate,
      planAdjusted: adjusted[i],
      discount: discounts[i],
      taxable,
      gstRate,
      gst,
      total: taxable + gst,
    };
  });

  const discountTotal = lines.reduce((a, l) => a + l.discount, 0);
  const taxTotal = lines.reduce((a, l) => a + l.gst, 0);
  return {
    lines,
    nights: nights.length,
    roomTotal,
    discountTotal,
    taxTotal,
    grandTotal: roomTotal - discountTotal + taxTotal,
    promoCode: promo?.code,
  };
}

export type PromoRules = {
  active: boolean;
  minNights: number;
  validFrom: Date;
  validTo: Date;
  maxRedemptions: number | null;
  redemptions: number;
};

/** Returns a guest-facing reason the promo can't be used, or null if it can. */
export function promoProblem(promo: PromoRules, checkIn: Date, checkOut: Date, nights: number): string | null {
  if (!promo.active) return "This code is no longer active.";
  if (nights < promo.minNights) return `This code needs a stay of at least ${promo.minNights} nights.`;
  const lastNight = new Date(checkOut.getTime() - 86_400_000);
  if (checkIn < promo.validFrom || lastNight > promo.validTo) return "This code isn't valid for these dates.";
  if (promo.maxRedemptions !== null && promo.redemptions >= promo.maxRedemptions)
    return "This code has been fully redeemed.";
  return null;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export function formatINR(n: number): string {
  return inr.format(n);
}
