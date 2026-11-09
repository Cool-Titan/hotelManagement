import { describe, expect, it } from "vitest";
import { insertQuote, roomsNeeded } from "../src/lib/ai/quote";

const plantation = { maxAdults: 2, maxChildren: 1, maxGuests: 3 };
const villa = { maxAdults: 4, maxChildren: 2, maxGuests: 5 };

describe("roomsNeeded", () => {
  it("fits a couple with a child in one room", () => expect(roomsNeeded(plantation, 2, 1)).toBe(1));
  it("splits 4 adults into 2 plantation rooms but 1 villa", () => {
    expect(roomsNeeded(plantation, 4, 0)).toBe(2);
    expect(roomsNeeded(villa, 4, 0)).toBe(1);
  });
  it("accounts for children and total occupancy", () => {
    expect(roomsNeeded(villa, 6, 4)).toBe(2);
    expect(roomsNeeded(plantation, 2, 3)).toBe(3);
  });
  it("leaves big groups to the sales team", () => expect(roomsNeeded(plantation, 45, 0)).toBeNull());
});

describe("insertQuote", () => {
  const quote = "Sat 14 Nov – Mon 16 Nov 2026\n• Pool Villa: ₹52,864";
  it("replaces the placeholder even when the AI puts it mid-paragraph", () => {
    const out = insertQuote("Thank you for writing. [[QUOTE]] Our team will confirm shortly.\n\nWarm regards,", quote);
    expect(out).toBe(`Thank you for writing.\n\n${quote}\n\nOur team will confirm shortly.\n\nWarm regards,`);
  });
  it("drops the placeholder when there is no quote", () => {
    expect(insertQuote("Hello\n\n[[QUOTE]]\n\nWarm regards,", "")).toBe("Hello\n\nWarm regards,");
  });
  it("adds the quote after the first paragraph if the AI forgot the placeholder", () => {
    expect(insertQuote("Hello there.\n\nWarm regards,", quote)).toBe(`Hello there.\n\n${quote}\n\nWarm regards,`);
  });
});
