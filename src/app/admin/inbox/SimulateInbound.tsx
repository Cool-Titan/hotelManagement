"use client";

import { useActionState, useRef, useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { simulateInbound, type SimState } from "@/app/actions/inbox";
import { FormError, SubmitButton } from "@/components/forms";

const SAMPLES = [
  { channel: "WHATSAPP", fromName: "Nikhil Rao", fromContact: "+91 98450 11223", message: "Is a villa free 14-16 Nov for 2 adults and a child?" },
  { channel: "EMAIL", fromName: "Deepa Kulkarni", fromContact: "deepa.k@example.com", subject: "Wedding venue", message: "Venue for my sister's wedding in Feb 2027, about 250 guests, 2 nights" },
  { channel: "EMAIL", fromName: "Sameer Joshi", fromContact: "sameer.joshi@example.com", subject: "Offsite", message: "Team of 45 wants a January offsite with a conference hall" },
  { channel: "WHATSAPP", fromName: "Asha", fromContact: "+91 99000 12121", message: "The water heater in our room has not worked since last night and housekeeping keeps saying 'coming'. Not acceptable." },
  { channel: "WHATSAPP", fromName: "Unknown", fromContact: "+91 90000 33333", message: "hi" },
] as const;

/** Simulates an email or WhatsApp arriving. Same code path as the real webhooks. */
export function SimulateInbound() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SimState, FormData>(simulateInbound, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  function fill(i: number) {
    const s = SAMPLES[i];
    const f = formRef.current;
    if (!f) return;
    (f.elements.namedItem("channel") as HTMLSelectElement).value = s.channel;
    (f.elements.namedItem("fromName") as HTMLInputElement).value = s.fromName;
    (f.elements.namedItem("fromContact") as HTMLInputElement).value = s.fromContact;
    (f.elements.namedItem("subject") as HTMLInputElement).value = "subject" in s ? s.subject : "";
    (f.elements.namedItem("message") as HTMLTextAreaElement).value = s.message;
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <FlaskConical size={15} aria-hidden /> Simulate incoming message
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="sim-title">
      <div className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="sim-title" className="font-serif text-xl">Simulate an incoming message</h2>
            <p className="mt-1 text-[13px] text-ink-2">Stands in for the email-forwarding and WhatsApp webhooks.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm !px-2" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["Villa (ENQ-4411)", "Wedding (ENQ-4410)", "Offsite (ENQ-4412)", "Complaint", "Vague"].map((l, i) => (
            <button key={l} type="button" onClick={() => fill(i)} className="chip border border-line-2 bg-paper text-ink-2 hover:border-ink-3">
              {l}
            </button>
          ))}
        </div>
        <form ref={formRef} action={action} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Channel</span>
              <select name="channel" className="input">
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Forwarded email</option>
              </select>
            </label>
            <label className="block">
              <span className="label">From</span>
              <input name="fromName" className="input" required />
            </label>
          </div>
          <label className="block">
            <span className="label">Phone or email</span>
            <input name="fromContact" className="input" required />
          </label>
          <label className="block">
            <span className="label">Subject (email only)</span>
            <input name="subject" className="input" />
          </label>
          <label className="block">
            <span className="label">Message</span>
            <textarea name="message" className="input h-28 py-2" required />
          </label>
          <FormError message={state?.error} />
          {state?.ok && (
            <p role="status" className="rounded-lg bg-estate-soft px-3 py-2 text-sm text-estate">
              {state.reference} received — it will be classified in a few seconds.
            </p>
          )}
          <SubmitButton pending={pending} pendingText="Sending…">Deliver message</SubmitButton>
        </form>
      </div>
    </div>
  );
}
