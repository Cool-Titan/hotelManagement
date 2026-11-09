"use client";

import { useState } from "react";
import { Search } from "lucide-react";

// A plain GET form: works before JavaScript loads (slow networks), and the
// result is a shareable URL. JS only keeps check-out after check-in.
export function StaySearch({
  action = "/",
  initial,
  today,
  compact = false,
}: {
  action?: string;
  initial: { checkIn: string; checkOut: string; adults: number; children: number };
  today: string;
  compact?: boolean;
}) {
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);

  function onCheckIn(v: string) {
    setCheckIn(v);
    if (v && (!checkOut || checkOut <= v)) {
      const d = new Date(`${v}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      setCheckOut(d.toISOString().slice(0, 10));
    }
  }
  const minOut = (() => {
    if (!checkIn) return today;
    const d = new Date(`${checkIn}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <form
      action={action}
      method="get"
      className={`grid grid-cols-2 gap-3 ${compact ? "md:grid-cols-[1fr_1fr_0.7fr_0.7fr_auto]" : "rounded-2xl bg-surface p-3 shadow-[0_8px_40px_rgba(0,0,0,0.12)] sm:p-4 md:grid-cols-[1fr_1fr_0.7fr_0.7fr_auto]"}`}
    >
      <label className="block">
        <span className="label">Check-in</span>
        <input className="input" type="date" name="in" required min={today} value={checkIn} onChange={(e) => onCheckIn(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Check-out</span>
        <input className="input" type="date" name="out" required min={minOut} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Adults</span>
        <select className="input" name="adults" defaultValue={initial.adults}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Children</span>
        <select className="input" name="children" defaultValue={initial.children}>
          {[0, 1, 2, 3, 4].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <button className="btn-primary col-span-2 self-end md:col-span-1">
        <Search size={16} aria-hidden /> Check availability
      </button>
    </form>
  );
}
