"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { holdRoom, type BookingFormState } from "@/app/actions/booking";

const COUNTRIES = ["India", "United States", "United Kingdom", "United Arab Emirates", "Singapore", "Germany", "France", "Australia", "Japan", "Other"];

function FieldError({ msg, id }: { msg?: string; id: string }) {
  return msg ? (
    <p id={id} className="mt-1 text-[13px] text-cherry">
      {msg}
    </p>
  ) : null;
}

export function BookingForm({
  hidden,
  defaults,
  promo,
}: {
  hidden: Record<string, string>;
  defaults: { name: string; email: string; phone: string };
  promo: { value: string; message: string | null; ok: boolean };
}) {
  const [state, action, pending] = useActionState<BookingFormState, FormData>(holdRoom, undefined);
  const fe = state?.fieldErrors ?? {};
  const v = { ...defaults, country: "India", requests: "", ...state?.values };
  const promoUrl = (value: string) => `?${new URLSearchParams({ ...hidden, promo: value })}`;

  return (
    <div className="mt-8 space-y-8">
      {/* Promo preview is a plain GET form, so it re-prices on the server. */}
      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label className="min-w-0 flex-1">
          <span className="label">Promo code</span>
          <input className="input uppercase" name="promo" defaultValue={promo.value} placeholder="e.g. DIRECT10" maxLength={20} autoComplete="off" />
        </label>
        <button className="btn-secondary">Apply</button>
        {promo.message && (
          <p className={`w-full text-[13px] ${promo.ok ? "text-estate" : "text-cherry"}`} role="status">
            {promo.message}
            {promo.ok && (
              <>
                {" · "}
                <Link href={promoUrl("")} className="underline">Remove</Link>
              </>
            )}
          </p>
        )}
      </form>

      <form action={action} className="space-y-5" noValidate>
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {promo.ok && <input type="hidden" name="promo" value={promo.value} />}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">Lead guest&apos;s full name</span>
            <input className="input" name="name" defaultValue={v.name} autoComplete="name" required aria-invalid={!!fe.name} aria-describedby="e-name" />
            <FieldError id="e-name" msg={fe.name} />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" name="email" defaultValue={v.email} autoComplete="email" required aria-invalid={!!fe.email} aria-describedby="e-email" />
            <FieldError id="e-email" msg={fe.email} />
          </label>
          <label className="block">
            <span className="label">Mobile (with country code)</span>
            <input className="input" type="tel" name="phone" defaultValue={v.phone} placeholder="+91 98450 12345" autoComplete="tel" required aria-invalid={!!fe.phone} aria-describedby="e-phone" />
            <FieldError id="e-phone" msg={fe.phone} />
          </label>
          <label className="block">
            <span className="label">Country of residence</span>
            <select className="input" name="country" defaultValue={v.country} aria-invalid={!!fe.country}>
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <FieldError id="e-country" msg={fe.country} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Special requests <span className="font-normal text-ink-3">(optional)</span></span>
            <textarea className="input h-24 py-2" name="requests" defaultValue={v.requests} maxLength={500} placeholder="Arrival time, dietary needs, a cot for the little one…" aria-invalid={!!fe.requests} />
            <FieldError id="e-requests" msg={fe.requests} />
          </label>
        </div>

        <p className="rounded-lg bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          Travelling on a foreign passport? We don&apos;t collect passport details online. The front desk completes Form C with
          you at check-in, as Indian law requires.
        </p>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-0.5 h-5 w-5 shrink-0 accent-estate" aria-invalid={!!fe.consent} aria-describedby="e-consent" />
          <span className="text-ink-2">
            I agree that Kaapi Estate may use these details to manage this booking and contact me about my stay.{" "}
            <Link href="/privacy" className="underline" target="_blank">How we use your data</Link>
          </span>
        </label>
        <FieldError id="e-consent" msg={fe.consent} />

        {state?.error && (
          <p role="alert" className="rounded-lg bg-cherry-soft px-4 py-3 text-sm text-cherry">
            {state.error}
          </p>
        )}

        <button className="btn-primary w-full sm:w-auto sm:px-8" disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden /> Holding your room…
            </>
          ) : (
            "Continue to payment"
          )}
        </button>
      </form>
    </div>
  );
}
