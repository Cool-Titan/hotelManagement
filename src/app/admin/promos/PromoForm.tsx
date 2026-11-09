"use client";

import { useActionState } from "react";
import { createPromo, type SimpleState } from "@/app/actions/rates";
import { FormError, SubmitButton } from "@/components/forms";

export function PromoForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(createPromo, undefined);
  return (
    <section className="card p-5" aria-labelledby="pc-h">
      <h2 id="pc-h" className="font-serif text-xl">New promo code</h2>
      <form action={action} className="mt-4 space-y-4">
        <label className="block">
          <span className="label">Code</span>
          <input name="code" className="input font-mono uppercase" maxLength={20} placeholder="MONSOON15" required />
        </label>
        <label className="block">
          <span className="label">Description (shown to guests)</span>
          <input name="description" className="input" maxLength={120} placeholder="15% off monsoon stays" required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Type</span>
            <select name="type" className="input">
              <option value="PERCENT">% off</option>
              <option value="FLAT">₹ off per stay</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Value</span>
            <input name="value" type="number" min={1} className="input" required />
          </label>
          <label className="block">
            <span className="label">First night</span>
            <input name="validFrom" type="date" defaultValue={today} className="input" required />
          </label>
          <label className="block">
            <span className="label">Last night</span>
            <input name="validTo" type="date" min={today} className="input" required />
          </label>
          <label className="block">
            <span className="label">Min. nights</span>
            <input name="minNights" type="number" min={1} max={14} defaultValue={1} className="input" />
          </label>
          <label className="block">
            <span className="label">Max uses</span>
            <input name="maxRedemptions" type="number" min={1} className="input" placeholder="no limit" />
          </label>
        </div>
        <FormError message={state?.error} />
        {state?.ok && <p role="status" className="text-sm text-estate">Promo code created.</p>}
        <SubmitButton pending={pending} pendingText="Saving…" className="btn-primary w-full">Create code</SubmitButton>
      </form>
    </section>
  );
}
