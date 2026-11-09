import { addDays, isIsoDate, nightsBetween, parseIsoDate, todayIST, toIsoDate } from "./dates";
import { MAX_NIGHTS } from "./stay-limits";

export type StayQuery = {
  checkIn: string | null;
  checkOut: string | null;
  adults: number;
  children: number;
  error: string | null;
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function clampInt(v: string | undefined, min: number, max: number, dflt: number) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}

/** Validates ?in=&out=&adults=&children= from the URL. Never throws. */
export function parseStayQuery(sp: SP): StayQuery {
  const rawIn = one(sp.in);
  const rawOut = one(sp.out);
  const adults = clampInt(one(sp.adults), 1, 6, 2);
  const children = clampInt(one(sp.children), 0, 4, 0);
  if (!rawIn && !rawOut) return { checkIn: null, checkOut: null, adults, children, error: null };
  if (!rawIn || !rawOut || !isIsoDate(rawIn) || !isIsoDate(rawOut))
    return { checkIn: null, checkOut: null, adults, children, error: "Please choose both a check-in and a check-out date." };
  const a = parseIsoDate(rawIn);
  const b = parseIsoDate(rawOut);
  const today = todayIST();
  if (a < today) return { checkIn: null, checkOut: null, adults, children, error: "Check-in can't be in the past." };
  const n = nightsBetween(a, b);
  if (n < 1) return { checkIn: null, checkOut: null, adults, children, error: "Check-out must be after check-in." };
  if (n > MAX_NIGHTS)
    return { checkIn: null, checkOut: null, adults, children, error: `Online bookings are up to ${MAX_NIGHTS} nights. For longer stays, write to us.` };
  if (a > addDays(today, 365)) return { checkIn: null, checkOut: null, adults, children, error: "We take bookings up to a year ahead." };
  return { checkIn: rawIn, checkOut: rawOut, adults, children, error: null };
}

export function stayQueryString(q: { checkIn: string | null; checkOut: string | null; adults: number; children: number }) {
  const p = new URLSearchParams();
  if (q.checkIn) p.set("in", q.checkIn);
  if (q.checkOut) p.set("out", q.checkOut);
  p.set("adults", String(q.adults));
  if (q.children) p.set("children", String(q.children));
  return p.toString();
}

export function defaultStay() {
  const t = todayIST();
  return { checkIn: toIsoDate(addDays(t, 7)), checkOut: toIsoDate(addDays(t, 9)) };
}
