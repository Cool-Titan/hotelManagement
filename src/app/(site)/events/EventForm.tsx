"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { submitEventEnquiry, type EnquiryFormState } from "@/app/actions/enquiry";
import { BUDGETS, EVENT_TYPES, WEDDING_FUNCTIONS } from "@/lib/enquiry-schemas";
import { Field, FormError, Honeypot, SubmitButton } from "@/components/forms";

export function EventForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<EnquiryFormState, FormData>(submitEventEnquiry, undefined);

  if (state?.ok) {
    return (
      <div className="card p-8 text-center" role="status">
        <CircleCheck size={32} className="mx-auto text-estate" aria-hidden />
        <h2 className="mt-3 font-serif text-2xl">Thank you — we have your enquiry</h2>
        <p className="mt-2 text-ink-2">
          Your reference is <span className="font-mono">{state.reference}</span>. Our events team replies within working hours, usually within 30 minutes.
        </p>
        <Link href="/" className="btn-secondary mt-6">Back to the estate</Link>
      </div>
    );
  }
  const fe = (state && !state.ok && state.fieldErrors) || {};
  const v = (state && !state.ok && state.values) || {};

  return (
    <form action={action} className="card relative space-y-6 p-5 sm:p-8" noValidate>
      <Honeypot />
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 font-serif text-xl">The occasion</legend>
        <Field label="Type of event" name="eventType" error={fe.eventType}>
          <select id="eventType" name="eventType" className="input" defaultValue={v.eventType || "Wedding"} aria-invalid={!!fe.eventType}>
            {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Expected guests" name="guests" error={fe.guests}>
          <input id="guests" name="guests" type="number" min={10} max={1000} className="input" defaultValue={v.guests} placeholder="e.g. 150" aria-invalid={!!fe.guests} />
        </Field>
        <Field label="Preferred date" name="preferredDate" error={fe.preferredDate}>
          <input id="preferredDate" name="preferredDate" type="date" min={today} className="input" defaultValue={v.preferredDate} aria-invalid={!!fe.preferredDate} />
          <label className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" name="flexibleDates" className="h-4 w-4 accent-estate" /> Our dates are flexible
          </label>
        </Field>
        <Field label="Indicative budget" name="budgetInr" hint="Helps us suggest the right venue and menus.">
          <select id="budgetInr" name="budgetInr" className="input" defaultValue={v.budgetInr ?? ""}>
            {BUDGETS.map((b) => <option key={b.label} value={b.value}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Nights of stay" name="nights" error={fe.nights}>
          <select id="nights" name="nights" className="input" defaultValue={v.nights || "2"}>
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 0 ? "No stay, day event" : `${n} night${n > 1 ? "s" : ""}`}</option>)}
          </select>
        </Field>
        <Field label="Rooms needed (approx.)" name="roomsNeeded" error={fe.roomsNeeded} hint="We have 64 rooms and 12 villas.">
          <input id="roomsNeeded" name="roomsNeeded" type="number" min={0} max={76} className="input" defaultValue={v.roomsNeeded || "0"} aria-invalid={!!fe.roomsNeeded} />
        </Field>
        <div className="sm:col-span-2">
          <p className="label">Functions (for weddings)</p>
          <div className="flex flex-wrap gap-2">
            {WEDDING_FUNCTIONS.map((f) => (
              <label key={f} className="flex cursor-pointer items-center gap-2 rounded-full border border-line-2 px-3 py-1.5 text-sm has-[:checked]:border-estate has-[:checked]:bg-estate-soft">
                <input type="checkbox" name="functions" value={f} className="sr-only" /> {f}
              </label>
            ))}
          </div>
        </div>
        <Field label="Anything else we should know?" name="message" className="sm:col-span-2">
          <textarea id="message" name="message" className="input h-28 py-2" maxLength={3000} defaultValue={v.message} placeholder="The feel you're after, catering preferences, accessibility needs…" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 border-t border-line pt-6 sm:grid-cols-3">
        <legend className="mb-4 pt-6 font-serif text-xl">How can we reach you?</legend>
        <Field label="Your name" name="name" error={fe.name}>
          <input id="name" name="name" className="input" autoComplete="name" defaultValue={v.name} aria-invalid={!!fe.name} />
        </Field>
        <Field label="Email" name="email" error={fe.email}>
          <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={v.email} aria-invalid={!!fe.email} />
        </Field>
        <Field label="Phone (optional)" name="phone" error={fe.phone}>
          <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" defaultValue={v.phone} aria-invalid={!!fe.phone} />
        </Field>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" className="mt-0.5 h-5 w-5 shrink-0 accent-estate" />
        <span className="text-ink-2">
          I agree that Kaapi Estate may use these details to reply to this enquiry. <Link href="/privacy" className="underline">How we use your data</Link>
        </span>
      </label>
      {fe.consent && <p className="-mt-4 text-[13px] text-cherry">{fe.consent}</p>}

      <FormError message={state && !state.ok ? state.error : undefined} />
      <SubmitButton pending={pending} pendingText="Sending…">Send enquiry</SubmitButton>
    </form>
  );
}
