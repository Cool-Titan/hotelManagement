"use client";

import { useActionState } from "react";
import { createBlackout, type SimpleState } from "@/app/actions/rates";
import { FormError, SubmitButton } from "@/components/forms";

export function BlackoutForm({ rooms, today }: { rooms: { id: string; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(createBlackout, undefined);
  return (
    <section className="card p-5" aria-labelledby="bo-h">
      <h2 id="bo-h" className="font-serif text-xl">Add a blackout</h2>
      <form action={action} className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">First night</span>
            <input type="date" name="startDate" min={today} className="input" required />
          </label>
          <label className="block">
            <span className="label">Last night</span>
            <input type="date" name="endDate" min={today} className="input" required />
          </label>
        </div>
        <label className="block">
          <span className="label">Applies to</span>
          <select name="roomTypeId" className="input" defaultValue="">
            <option value="">Whole property</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Reason (staff only)</span>
          <input name="reason" className="input" maxLength={120} placeholder="e.g. Wedding buy-out" required />
        </label>
        <FormError message={state?.error} />
        {state?.ok && <p role="status" className="text-sm text-estate">Blackout added.</p>}
        <SubmitButton pending={pending} pendingText="Saving…" className="btn-primary w-full">Close these dates online</SubmitButton>
      </form>
    </section>
  );
}
