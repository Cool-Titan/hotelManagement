import { z } from "zod";
import { isIsoDate } from "./dates";

const name = z.string().trim().min(2, "Enter your name.").max(80);
const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const phone = z
  .string()
  .trim()
  .regex(/^$|^\+?[0-9 ()-]{8,20}$/, "Enter a valid phone number.")
  .optional();
const consent = z.literal("on", { message: "Please agree so we can reply to you." });

export const ContactSchema = z.object({
  name,
  email,
  phone,
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(3000),
  consent,
});

export const EVENT_TYPES = ["Wedding", "Engagement", "Reception", "Corporate offsite", "Conference", "Celebration"] as const;
export const WEDDING_FUNCTIONS = ["Haldi", "Mehendi", "Sangeet", "Wedding ceremony", "Reception"] as const;
export const BUDGETS = [
  { value: "500000", label: "Under ₹5 lakh" },
  { value: "1500000", label: "₹5–15 lakh" },
  { value: "3000000", label: "₹15–30 lakh" },
  { value: "5000000", label: "₹30–50 lakh" },
  { value: "8000000", label: "₹50 lakh+" },
  { value: "", label: "Not sure yet" },
] as const;

export const EventSchema = z
  .object({
    name,
    email,
    phone,
    eventType: z.enum(EVENT_TYPES, { message: "Choose the type of event." }),
    preferredDate: z.string().refine((s) => s === "" || isIsoDate(s), "Enter a valid date.").optional(),
    flexibleDates: z.string().optional(),
    guests: z.coerce.number({ message: "Enter the number of guests." }).int().min(10, "Events start at 10 guests.").max(1000, "For more than 1,000 guests, write to us."),
    nights: z.coerce.number().int().min(0).max(7),
    roomsNeeded: z.coerce.number().int().min(0).max(76, "We have 76 keys in total."),
    budgetInr: z.string().regex(/^\d*$/).optional(),
    functions: z.array(z.enum(WEDDING_FUNCTIONS)).max(5).optional(),
    message: z.string().trim().max(3000).optional(),
    consent,
  })
  .refine((v) => v.preferredDate || v.flexibleDates === "on", { message: "Give a preferred date or tick 'dates are flexible'.", path: ["preferredDate"] });

// Payload shape for simulated inbound webhooks (forwarded email / WhatsApp).
export const InboundSchema = z.object({
  fromName: z.string().trim().min(1).max(120),
  fromContact: z.string().trim().min(3).max(120),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
});
