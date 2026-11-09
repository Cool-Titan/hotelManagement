"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { updateInventory, type RatesState } from "@/app/actions/rates";
import { FormError, SubmitButton } from "@/components/forms";

type Cell = { date: string; rate: number | null; allotment: number | null; sold: number; held: number; stopSell: boolean; blackout: string | null };
type Grid = { dates: string[]; rooms: { id: string; name: string; totalUnits: number; cells: Cell[] }[] };

const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RatesBoard({ grid, today, from, prev, next }: { grid: Grid; today: string; from: string; prev: string | null; next: string }) {
  const [state, action, pending] = useActionState<RatesState, FormData>(updateInventory, undefined);
  const [sel, setSel] = useState<{ rooms: string[]; from: string; to: string; rate: string; allotment: string }>({
    rooms: grid.rooms.map((r) => r.id),
    from,
    to: grid.dates.at(-1) ?? from,
    rate: "",
    allotment: "",
  });

  function pickCell(roomId: string, c: Cell) {
    setSel({ rooms: [roomId], from: c.date, to: c.date, rate: c.rate ? String(c.rate) : "", allotment: c.allotment !== null ? String(c.allotment) : "" });
    document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="mt-6 grid gap-6 2xl:grid-cols-[1fr_360px]">
      <section className="card min-w-0 overflow-hidden" aria-label="Inventory grid">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-sm font-medium">
            {dateFmt.format(new Date(`${grid.dates[0]}T00:00:00Z`))} – {dateFmt.format(new Date(`${grid.dates.at(-1)}T00:00:00Z`))}
          </p>
          <div className="flex gap-1">
            {prev ? (
              <Link href={`?from=${prev}`} className="btn-ghost btn-sm !px-2" aria-label="Earlier dates"><ChevronLeft size={18} /></Link>
            ) : (
              <span className="btn-ghost btn-sm !px-2 opacity-30" aria-hidden><ChevronLeft size={18} /></span>
            )}
            <Link href={`?from=${next}`} className="btn-ghost btn-sm !px-2" aria-label="Later dates"><ChevronRight size={18} /></Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-36 bg-surface px-3 py-2 text-left font-medium text-ink-2">Room type</th>
                {grid.dates.map((d) => {
                  const dt = new Date(`${d}T00:00:00Z`);
                  const weekend = dt.getUTCDay() === 5 || dt.getUTCDay() === 6;
                  return (
                    <th key={d} className={`min-w-[74px] px-1 py-2 text-center font-normal ${weekend ? "bg-paper" : ""}`}>
                      <span className="block text-ink-3">{dayFmt.format(dt)}</span>
                      <span className={`block ${d === today ? "font-semibold text-estate" : "text-ink"}`}>{dateFmt.format(dt)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grid.rooms.map((room) => (
                <tr key={room.id} className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">
                    {room.name}
                    <span className="block text-[11px] font-normal text-ink-3">{room.totalUnits} keys</span>
                  </th>
                  {room.cells.map((c) => {
                    const left = c.allotment !== null ? c.allotment - c.sold - c.held : 0;
                    const closed = c.stopSell || !!c.blackout || c.rate === null;
                    const full = !closed && left <= 0;
                    return (
                      <td key={c.date} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => pickCell(room.id, c)}
                          title={c.blackout ? `Blackout: ${c.blackout}` : c.stopSell ? "Stop-sell" : `${c.sold} sold, ${c.held} on hold, ${left} left of ${c.allotment}`}
                          className={`w-full rounded-md px-1 py-1.5 text-center transition-colors hover:ring-2 hover:ring-estate/30 ${
                            closed ? "bg-[repeating-linear-gradient(135deg,#f1eee8,#f1eee8_4px,#e8e4dc_4px,#e8e4dc_8px)] text-ink-3" : full ? "bg-cherry-soft" : left <= 2 ? "bg-amber-soft" : "bg-estate-soft/60"
                          }`}
                        >
                          <span className="block font-medium text-ink">{c.rate ? c.rate.toLocaleString("en-IN") : "—"}</span>
                          <span className="block text-[11px]">
                            {c.blackout ? "blackout" : c.stopSell ? "stop-sell" : c.allotment === null ? "not loaded" : `${c.sold + c.held}/${c.allotment}`}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[11px] text-ink-3">
          <span>Cell: room-only rate (₹) · booked/allotment</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-soft ring-1 ring-amber/30" />2 or fewer left</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-cherry-soft ring-1 ring-cherry/30" />sold out online</span>
          <span>Striped: closed</span>
          <span>Click a cell to edit it</span>
        </p>
      </section>

      <section id="editor" className="card p-5" aria-labelledby="editor-h">
        <h2 id="editor-h" className="font-serif text-xl">Update rates</h2>
        <p className="mt-1 text-[13px] text-ink-2">Leave a field empty to keep what&apos;s there.</p>
        <form action={action} className="mt-4 space-y-4" key={`${sel.rooms.join()}-${sel.from}-${sel.to}`}>
          <fieldset>
            <legend className="label">Room types</legend>
            <div className="flex flex-wrap gap-2">
              {grid.rooms.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-line-2 px-3 py-1.5 text-[13px] has-[:checked]:border-estate has-[:checked]:bg-estate-soft">
                  <input type="checkbox" name="roomTypeIds" value={r.id} defaultChecked={sel.rooms.includes(r.id)} className="h-3.5 w-3.5 accent-estate" />
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">From</span>
              <input type="date" name="from" min={today} defaultValue={sel.from} className="input" required />
            </label>
            <label className="block">
              <span className="label">To (inclusive)</span>
              <input type="date" name="to" min={today} defaultValue={sel.to} className="input" required />
            </label>
          </div>
          <fieldset>
            <legend className="label">On these days</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((w, i) => (
                <label key={w} className="flex cursor-pointer items-center rounded-md border border-line-2 px-2 py-1 text-[12px] has-[:checked]:border-estate has-[:checked]:bg-estate-soft">
                  <input type="checkbox" name="weekdays" value={i + 1} defaultChecked className="sr-only" />
                  {w}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Room rate (₹/night)</span>
              <input type="number" name="rate" min={1000} max={200000} step={100} defaultValue={sel.rate} placeholder="keep" className="input" />
            </label>
            <label className="block">
              <span className="label">Website allotment</span>
              <input type="number" name="allotment" min={0} max={76} defaultValue={sel.allotment} placeholder="keep" className="input" />
            </label>
          </div>
          <label className="block">
            <span className="label">Stop-sell</span>
            <select name="stopSell" className="input" defaultValue="">
              <option value="">Keep as is</option>
              <option value="on">Close these nights online</option>
              <option value="off">Open these nights online</option>
            </select>
          </label>
          <FormError message={state?.error} />
          {state?.ok && (
            <div role="status" className="rounded-lg bg-estate-soft px-3 py-2 text-[13px] text-estate">
              {state.message}
              {state.conflicts && state.conflicts.length > 0 && (
                <div className="mt-2 text-amber">
                  <p className="font-medium">Not changed — more rooms already booked than the new allotment:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {state.conflicts.slice(0, 8).map((c) => <li key={c}>{c}</li>)}
                    {state.conflicts.length > 8 && <li>and {state.conflicts.length - 8} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
          <SubmitButton pending={pending} pendingText="Saving…" className="btn-primary w-full">Apply changes</SubmitButton>
        </form>
      </section>
    </div>
  );
}
