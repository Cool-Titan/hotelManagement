// Deterministic extraction of dates, party size and budget from free text.
// Used when the AI is unavailable, and to sanity-check what the AI returns.

import { addDays, isIsoDate, parseIsoDate, toIsoDate } from "../dates";

export type Extracted = {
  checkIn: string | null; // YYYY-MM-DD
  checkOut: string | null;
  dateText: string | null; // what the guest wrote, e.g. "Feb 2027"
  nights: number | null;
  adults: number | null;
  children: number | null;
  guests: number | null; // total headcount for events/groups
  budgetInr: number | null;
  roomPreference: "ROOM" | "SUITE" | "VILLA" | null;
};

export const EMPTY_EXTRACTED: Extracted = {
  checkIn: null,
  checkOut: null,
  dateText: null,
  nights: null,
  adults: null,
  children: null,
  guests: null,
  budgetInr: null,
  roomPreference: null,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const WORD_NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function num(s: string): number {
  const k = s.toLowerCase();
  return k in WORD_NUM ? WORD_NUM[k] : parseInt(s.replace(/,/g, ""), 10);
}

/** Next occurrence of day/month on or after `today` when no year is given. */
function resolveDate(day: number, month: number, year: number | null, today: Date): Date | null {
  const y = year ?? today.getUTCFullYear();
  const d = new Date(Date.UTC(y, month, day));
  if (d.getUTCMonth() !== month) return null; // e.g. 31 Feb
  if (year === null && d < today) return new Date(Date.UTC(y + 1, month, day));
  return d;
}

export function extractDates(text: string, today: Date) {
  const t = text.toLowerCase();
  let checkIn: Date | null = null;
  let checkOut: Date | null = null;
  let dateText: string | null = null;

  // "14-16 Nov", "14th to 16th November 2026", "14 – 16 nov"
  const range = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|–|to|till|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?(?:,?\\s*(\\d{4}))?`,
  ).exec(t);
  // "14 Nov to 16 Nov", "14 nov - 2 dec 2026"
  const twoDates = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?(?:,?\\s*(\\d{4}))?\\s*(?:-|–|to|till|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?(?:,?\\s*(\\d{4}))?`,
  ).exec(t);
  const iso = /\b(\d{4}-\d{2}-\d{2})\b.*?\b(\d{4}-\d{2}-\d{2})\b/.exec(t);

  if (twoDates) {
    const y2 = twoDates[6] ? +twoDates[6] : null;
    const y1 = twoDates[3] ? +twoDates[3] : y2;
    checkIn = resolveDate(+twoDates[1], MONTHS[twoDates[2]], y1, today);
    checkOut = checkIn ? resolveDate(+twoDates[4], MONTHS[twoDates[5]], y2 ?? checkIn.getUTCFullYear(), today) : null;
    dateText = twoDates[0];
  } else if (range) {
    const month = MONTHS[range[3]];
    const year = range[4] ? +range[4] : null;
    checkIn = resolveDate(+range[1], month, year, today);
    checkOut = checkIn ? resolveDate(+range[2], month, checkIn.getUTCFullYear(), today) : null;
    dateText = range[0];
  } else if (iso && isIsoDate(iso[1]) && isIsoDate(iso[2])) {
    checkIn = parseIsoDate(iso[1]);
    checkOut = parseIsoDate(iso[2]);
    dateText = `${iso[1]} to ${iso[2]}`;
  }

  if (checkIn && checkOut && checkOut <= checkIn) {
    // e.g. "30 Dec - 2 Jan" without years: roll check-out into next year.
    const rolled = new Date(Date.UTC(checkOut.getUTCFullYear() + 1, checkOut.getUTCMonth(), checkOut.getUTCDate()));
    checkOut = rolled > checkIn && rolled.getTime() - checkIn.getTime() < 31 * 86_400_000 ? rolled : null;
  }
  if (checkIn && checkIn < today) {
    checkIn = null;
    checkOut = null;
  }

  if (!dateText) {
    // Vague month mentions: "Feb 2027", "in January", "this December"
    const m = new RegExp(`\\b${MONTH_RE}\\.?(?:,?\\s*(\\d{4}))?\\b`).exec(t);
    if (m) dateText = m[0];
  }

  return {
    checkIn: checkIn ? toIsoDate(checkIn) : null,
    checkOut: checkIn && checkOut ? toIsoDate(checkOut) : null,
    dateText,
  };
}

export function extractBudget(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, "");
  const lakh = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|l)\b/.exec(t);
  if (lakh && /budget|lakh|lac|₹|rs|inr|spend|afford/.test(t)) return Math.round(parseFloat(lakh[1]) * 100_000);
  const crore = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:crores?|cr)\b/.exec(t);
  if (crore) return Math.round(parseFloat(crore[1]) * 10_000_000);
  const thousand = /(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*k\b/.exec(t);
  if (thousand) return Math.round(parseFloat(thousand[1]) * 1000);
  const plain = /(?:₹|rs\.?|inr)\s*(\d{4,})/.exec(t);
  if (plain) return parseInt(plain[1], 10);
  const budgetWord = /budget[^\d]{0,20}(\d{4,})/.exec(t);
  if (budgetWord) return parseInt(budgetWord[1], 10);
  return null;
}

export function extractParty(text: string) {
  const t = text.toLowerCase();
  const n = "(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)";
  const adults = new RegExp(`\\b${n}\\s+adults?\\b`).exec(t);
  const kids = new RegExp(`\\b${n}\\s+(?:child|children|kids?)\\b`).exec(t);
  const group =
    /\b(?:about|around|approx\.?|approximately|~)?\s*(\d{2,4})\s*(?:\+\s*)?(?:guests|people|pax|persons|attendees|delegates|employees|colleagues|members)\b/.exec(t) ??
    /\b(?:team|group|batch|party) of (\d{1,4})\b/.exec(t);
  const nights = /\b(\d{1,2}|one|two|three|four|five|six|seven)[\s-]+nights?\b/.exec(t);
  return {
    adults: adults ? num(adults[1]) : null,
    children: kids ? num(kids[1]) : null,
    guests: group ? parseInt(group[1], 10) : null,
    nights: nights ? num(nights[1]) : null,
  };
}

export function extractRoomPreference(text: string): Extracted["roomPreference"] {
  const t = text.toLowerCase();
  if (/\bvillas?\b/.test(t)) return "VILLA";
  if (/\bsuites?\b/.test(t)) return "SUITE";
  if (/\brooms?\b/.test(t)) return "ROOM";
  return null;
}

export function extractAll(text: string, today: Date): Extracted {
  const dates = extractDates(text, today);
  const party = extractParty(text);
  let { checkOut } = dates;
  if (dates.checkIn && !checkOut && party.nights) {
    checkOut = toIsoDate(addDays(parseIsoDate(dates.checkIn), party.nights));
  }
  const nights =
    dates.checkIn && checkOut
      ? Math.round((parseIsoDate(checkOut).getTime() - parseIsoDate(dates.checkIn).getTime()) / 86_400_000)
      : party.nights;
  return {
    checkIn: dates.checkIn,
    checkOut,
    dateText: dates.dateText,
    nights,
    adults: party.adults,
    children: party.children,
    guests: party.guests ?? (party.adults !== null ? party.adults + (party.children ?? 0) : null),
    budgetInr: extractBudget(text),
    roomPreference: extractRoomPreference(text),
  };
}
