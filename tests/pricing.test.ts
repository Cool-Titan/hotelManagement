import { describe, expect, it } from "vitest";
import { gstRateFor, priceStay, promoProblem } from "../src/lib/pricing";
import { parseIsoDate } from "../src/lib/dates";

describe("GST slabs", () => {
  it("applies the slab for the nightly value actually charged", () => {
    expect(gstRateFor(1000)).toBe(0);
    expect(gstRateFor(1001)).toBe(5);
    expect(gstRateFor(7500)).toBe(5);
    expect(gstRateFor(7501)).toBe(18);
  });
});

describe("priceStay", () => {
  const plan = { supplementPerNight: 900, discountPct: 0 };

  it("adds the rate-plan supplement and GST per night", () => {
    const q = priceStay([{ date: "2026-12-01", rate: 6000 }, { date: "2026-12-02", rate: 7000 }], plan);
    // 6900 → 5%, 7900 → 18%
    expect(q.lines.map((l) => l.gstRate)).toEqual([5, 18]);
    expect(q.roomTotal).toBe(14800);
    expect(q.taxTotal).toBe(345 + 1422);
    expect(q.grandTotal).toBe(14800 + 1767);
  });

  it("a promo can move a night into a lower GST slab", () => {
    const q = priceStay([{ date: "2026-12-01", rate: 7000 }], plan, { code: "X", type: "PERCENT", value: 10 });
    // 7900 - 790 = 7110 → 5%
    expect(q.lines[0].taxable).toBe(7110);
    expect(q.lines[0].gstRate).toBe(5);
  });

  it("spreads a flat promo across nights so the total discount is exact", () => {
    const nights = [{ date: "a", rate: 5000 }, { date: "b", rate: 6000 }, { date: "c", rate: 7001 }];
    const q = priceStay(nights, { supplementPerNight: 0, discountPct: 0 }, { code: "F", type: "FLAT", value: 2000 });
    expect(q.discountTotal).toBe(2000);
    expect(q.lines.every((l) => l.discount > 0)).toBe(true);
  });

  it("never discounts below zero", () => {
    const q = priceStay([{ date: "a", rate: 1000 }], { supplementPerNight: 0, discountPct: 0 }, { code: "F", type: "FLAT", value: 99999 });
    expect(q.grandTotal).toBe(0);
  });

  it("applies the advance-purchase discount to the room rate only", () => {
    const q = priceStay([{ date: "a", rate: 10000 }], { supplementPerNight: 900, discountPct: 12 });
    expect(q.lines[0].planAdjusted).toBe(8800 + 900);
  });
});

describe("promoProblem", () => {
  const base = {
    active: true,
    minNights: 2,
    validFrom: parseIsoDate("2026-12-01"),
    validTo: parseIsoDate("2026-12-31"),
    maxRedemptions: 5,
    redemptions: 0,
  };
  const inD = parseIsoDate("2026-12-10");
  const outD = parseIsoDate("2026-12-12");

  it("accepts a valid code", () => expect(promoProblem(base, inD, outD, 2)).toBeNull());
  it("enforces minimum nights", () => expect(promoProblem(base, inD, parseIsoDate("2026-12-11"), 1)).toMatch(/at least 2/));
  it("checks every night is inside the validity window", () =>
    expect(promoProblem(base, parseIsoDate("2026-12-30"), parseIsoDate("2027-01-02"), 3)).toMatch(/dates/));
  it("rejects a fully redeemed code", () => expect(promoProblem({ ...base, redemptions: 5 }, inD, outD, 2)).toMatch(/fully/));
  it("rejects an inactive code", () => expect(promoProblem({ ...base, active: false }, inD, outD, 2)).toMatch(/no longer/));
});
