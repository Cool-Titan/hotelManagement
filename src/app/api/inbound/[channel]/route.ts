// Simulated inbound webhooks for forwarded email and WhatsApp.
// In production these would be the mail provider's inbound-parse webhook and
// the WhatsApp Business API webhook; here they accept a simple JSON payload.
//
//   POST /api/inbound/email     { fromName, fromContact, subject?, message }
//   POST /api/inbound/whatsapp  { fromName, fromContact, message }
//   Header: x-webhook-secret: <INBOUND_WEBHOOK_SECRET>

import { after, NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createEnquiry, routeEnquirySafely } from "@/lib/enquiries";
import { InboundSchema } from "@/lib/enquiry-schemas";

const CHANNELS = { email: "EMAIL", whatsapp: "WHATSAPP" } as const;

function secretOk(given: string | null) {
  const expected = process.env.INBOUND_WEBHOOK_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/inbound/[channel]">) {
  const { channel } = await ctx.params;
  const ch = CHANNELS[channel as keyof typeof CHANNELS];
  if (!ch) return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  if (!secretOk(req.headers.get("x-webhook-secret"))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = InboundSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });

  const e = await createEnquiry({ channel: ch, ...parsed.data, subject: ch === "EMAIL" ? parsed.data.subject : null });
  after(() => routeEnquirySafely(e.id));
  return NextResponse.json({ reference: e.reference, status: "received" }, { status: 202 });
}
