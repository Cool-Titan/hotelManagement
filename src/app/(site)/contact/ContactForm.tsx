"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { submitContact, type EnquiryFormState } from "@/app/actions/enquiry";
import { Field, FormError, Honeypot, SubmitButton } from "@/components/forms";

export function ContactForm() {
  const [state, action, pending] = useActionState<EnquiryFormState, FormData>(submitContact, undefined);
  if (state?.ok) {
    return (
      <div className="card p-8 text-center" role="status">
        <CircleCheck size={32} className="mx-auto text-estate" aria-hidden />
        <h2 className="mt-3 font-serif text-2xl">Message received</h2>
        <p className="mt-2 text-ink-2">
          Reference <span className="font-mono">{state.reference}</span>. We&apos;ll get back to you shortly.
        </p>
      </div>
    );
  }
  const fe = (state && !state.ok && state.fieldErrors) || {};
  const v = (state && !state.ok && state.values) || {};
  return (
    <form action={action} className="card relative space-y-5 p-5 sm:p-8" noValidate>
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="name" error={fe.name} className="sm:col-span-2">
          <input id="name" name="name" className="input" autoComplete="name" defaultValue={v.name} aria-invalid={!!fe.name} />
        </Field>
        <Field label="Email" name="email" error={fe.email}>
          <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={v.email} aria-invalid={!!fe.email} />
        </Field>
        <Field label="Phone (optional)" name="phone" error={fe.phone}>
          <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" defaultValue={v.phone} aria-invalid={!!fe.phone} />
        </Field>
        <Field label="Your message" name="message" error={fe.message} className="sm:col-span-2">
          <textarea id="message" name="message" className="input h-36 py-2" maxLength={3000} defaultValue={v.message} placeholder="Dates, number of guests, anything we can help with…" aria-invalid={!!fe.message} />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" className="mt-0.5 h-5 w-5 shrink-0 accent-estate" />
        <span className="text-ink-2">
          I agree that Kaapi Estate may use these details to reply to me. <Link href="/privacy" className="underline">How we use your data</Link>
        </span>
      </label>
      {fe.consent && <p className="-mt-3 text-[13px] text-cherry">{fe.consent}</p>}
      <FormError message={state && !state.ok ? state.error : undefined} />
      <SubmitButton pending={pending} pendingText="Sending…">Send message</SubmitButton>
    </form>
  );
}
