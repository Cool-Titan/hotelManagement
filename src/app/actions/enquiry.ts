"use server";

import { after } from "next/server";
import { createEnquiry, routeEnquirySafely } from "@/lib/enquiries";
import { ContactSchema, EventSchema, BUDGETS } from "@/lib/enquiry-schemas";
import { rateLimit } from "@/lib/rate-limit";
import { formatINR } from "@/lib/pricing";

export type EnquiryFormState =
  | { ok?: false; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | { ok: true; reference: string }
  | undefined;

function errors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

function echo(form: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "").slice(0, 3000)]));
}

export async function submitContact(_: EnquiryFormState, form: FormData): Promise<EnquiryFormState> {
  const values = echo(form, ["name", "email", "phone", "message"]);
  if (!(await rateLimit("enquiry", 5, 10 * 60_000))) return { error: "You've sent several messages already. Please wait a few minutes.", values };
  // Honeypot: real people never fill this hidden field.
  if (form.get("website")) return { ok: true, reference: "ENQ-THANKS" };
  const parsed = ContactSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: errors(parsed.error.issues), values };

  const e = await createEnquiry({
    channel: "WEB_FORM",
    fromName: parsed.data.name,
    fromContact: parsed.data.phone ? `${parsed.data.email} · ${parsed.data.phone}` : parsed.data.email,
    message: parsed.data.message,
  });
  after(() => routeEnquirySafely(e.id));
  return { ok: true, reference: e.reference };
}

export async function submitEventEnquiry(_: EnquiryFormState, form: FormData): Promise<EnquiryFormState> {
  const values = echo(form, ["name", "email", "phone", "eventType", "preferredDate", "guests", "nights", "roomsNeeded", "budgetInr", "message"]);
  if (!(await rateLimit("enquiry", 5, 10 * 60_000))) return { error: "You've sent several enquiries already. Please wait a few minutes.", values };
  if (form.get("website")) return { ok: true, reference: "ENQ-THANKS" };
  const parsed = EventSchema.safeParse({ ...Object.fromEntries(form), functions: form.getAll("functions") });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: errors(parsed.error.issues), values };
  const d = parsed.data;

  const budget = d.budgetInr ? Number(d.budgetInr) : null;
  const budgetLabel = BUDGETS.find((b) => b.value === d.budgetInr)?.label;
  const formData = {
    eventType: d.eventType,
    preferredDate: d.preferredDate || null,
    flexibleDates: d.flexibleDates === "on",
    guests: d.guests,
    nights: d.nights,
    roomsNeeded: d.roomsNeeded,
    budgetInr: budget,
    functions: d.functions ?? [],
  };
  // A readable summary for staff and the AI; the structured fields travel alongside.
  const summary = [
    `${d.eventType} for about ${d.guests} guests`,
    d.preferredDate ? `preferred date ${d.preferredDate}${d.flexibleDates === "on" ? " (flexible)" : ""}` : "dates flexible",
    d.nights ? `${d.nights} night${d.nights > 1 ? "s" : ""}, ${d.roomsNeeded} rooms` : "no stay",
    budget ? `budget ${budgetLabel ?? formatINR(budget)}` : "budget not decided",
    d.functions?.length ? `functions: ${d.functions.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const e = await createEnquiry({
    channel: "EVENT_FORM",
    fromName: d.name,
    fromContact: d.phone ? `${d.email} · ${d.phone}` : d.email,
    subject: `${d.eventType} enquiry (event form)`,
    message: d.message ? `${summary}.\n\n${d.message}` : `${summary}.`,
    formData,
  });
  after(() => routeEnquirySafely(e.id));
  return { ok: true, reference: e.reference };
}
