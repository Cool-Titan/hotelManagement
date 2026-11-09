"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Night = { date: string; rate: number; available: number; closed: boolean };

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const kFmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n));

function addDaysIso(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Pick check-in then check-out. A range can't cross a night that is sold out
 * or closed. Selecting updates the URL, and the server re-prices the stay.
 */
export function AvailabilityCalendar({
  nights,
  checkIn,
  checkOut,
  adults,
  childCount,
  maxNights,
}: {
  nights: Night[];
  checkIn: string | null;
  checkOut: string | null;
  adults: number;
  childCount: number;
  maxNights: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState<string | null>(checkIn);
  const [end, setEnd] = useState<string | null>(checkOut);
  const byDate = useMemo(() => new Map(nights.map((n) => [n.date, n])), [nights]);
  const first = nights[0]?.date ?? new Date().toISOString().slice(0, 10);
  const months = useMemo(() => {
    const out: string[] = [];
    const s = new Date(`${first.slice(0, 7)}-01T00:00:00Z`);
    const last = nights.at(-1)?.date ?? first;
    while (s.toISOString().slice(0, 10) <= last) {
      out.push(s.toISOString().slice(0, 7));
      s.setUTCMonth(s.getUTCMonth() + 1);
    }
    return out;
  }, [first, nights]);
  const initialMonth = Math.max(0, months.indexOf((checkIn ?? first).slice(0, 7)));
  const [page, setPage] = useState(Math.min(initialMonth, Math.max(0, months.length - 2)));

  const sellable = (iso: string) => {
    const n = byDate.get(iso);
    return !!n && !n.closed && n.available > 0;
  };

  function rangeOk(a: string, b: string) {
    for (let d = a; d < b; d = addDaysIso(d, 1)) if (!sellable(d)) return false;
    return true;
  }

  function pick(iso: string) {
    if (!start || (start && end) || iso <= start) {
      if (!sellable(iso)) return;
      setStart(iso);
      setEnd(null);
      return;
    }
    // choosing check-out: the night before it must be the last sold night
    const nightsCount = Math.round((Date.parse(iso) - Date.parse(start)) / 86_400_000);
    if (nightsCount > maxNights || !rangeOk(start, iso)) {
      if (sellable(iso)) {
        setStart(iso);
        setEnd(null);
      }
      return;
    }
    setEnd(iso);
    const p = new URLSearchParams({ in: start, out: iso, adults: String(adults) });
    if (childCount) p.set("children", String(childCount));
    startTransition(() => router.replace(`${pathname}?${p}#rates`, { scroll: false }));
  }

  return (
    <div className={pending ? "opacity-70 transition-opacity" : ""}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-2">
          {!start ? "Select your check-in date" : !end ? "Now select your check-out date" : "Tap a date to start over"}
        </p>
        <div className="flex gap-1">
          <button type="button" className="btn-ghost btn-sm !px-2" aria-label="Previous month" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="btn-ghost btn-sm !px-2" aria-label="Next month" disabled={page >= months.length - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        {months.slice(page, page + 2).map((m, idx) => {
          const firstDay = new Date(`${m}-01T00:00:00Z`);
          const offset = (firstDay.getUTCDay() + 6) % 7;
          const days = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)).getUTCDate();
          return (
            <div key={m} className={idx === 1 ? "hidden md:block" : ""}>
              <p className="mb-2 text-center text-sm font-medium">{monthFmt.format(firstDay)}</p>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="pb-1 text-[11px] text-ink-3">{w}</span>
                ))}
                {Array.from({ length: offset }, (_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: days }, (_, i) => {
                  const iso = `${m}-${String(i + 1).padStart(2, "0")}`;
                  const n = byDate.get(iso);
                  const ok = sellable(iso);
                  const isStart = iso === start;
                  const isEnd = iso === end;
                  const inRange = start && end && iso > start && iso < end;
                  const canBeCheckout = start && !end && iso > start && rangeOk(start, iso);
                  const clickable = ok || canBeCheckout;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={!clickable}
                      onClick={() => pick(iso)}
                      aria-pressed={isStart || isEnd}
                      aria-label={`${iso}${n ? (ok ? `, ₹${n.rate}, ${n.available} left` : ", unavailable") : ""}`}
                      className={[
                        "flex h-12 flex-col items-center justify-center rounded-lg text-[13px] leading-tight transition-colors",
                        isStart || isEnd ? "bg-estate text-white" : inRange ? "bg-estate-soft text-ink" : clickable ? "hover:bg-paper" : "",
                        !clickable ? "cursor-default text-ink-3/60 line-through decoration-ink-3/40" : "",
                      ].join(" ")}
                    >
                      <span className="font-medium">{i + 1}</span>
                      {n && ok ? (
                        <span className={`text-[10px] ${isStart || isEnd ? "text-white/80" : n.available <= 2 ? "text-cherry" : "text-ink-3"}`}>
                          {kFmt(n.rate)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-3">
        <span>Nightly room rate in ₹, before taxes</span>
        <span className="text-cherry">Red: 2 or fewer left</span>
        <span className="line-through">Struck: unavailable</span>
      </p>
    </div>
  );
}
