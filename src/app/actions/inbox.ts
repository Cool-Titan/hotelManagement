"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EnquiryCategory, Lane } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertStaff } from "@/lib/auth";
import { createEnquiry, ownerFor, routeEnquiry, routeEnquirySafely, signOff } from "@/lib/enquiries";
import { InboundSchema } from "@/lib/enquiry-schemas";
import { fallbackDraft } from "@/lib/ai/triage";
import { buildQuoteBlock, insertQuote } from "@/lib/ai/quote";
import { EMPTY_EXTRACTED, type Extracted } from "@/lib/ai/extract";

const Id = z.cuid();
const LaneEnum = z.enum(["ROOM", "WEDDING", "OFFSITE", "COMPLAINT", "UNSORTED"]);

function refresh(id?: string) {
  revalidatePath("/admin/inbox");
  if (id) revalidatePath(`/admin/inbox/${id}`);
}

/** One-click re-route by staff. Rebuilds the draft for the new lane unless staff already edited it. */
export async function rerouteEnquiry(id: string, lane: Lane) {
  const user = await assertStaff();
  const enquiryId = Id.parse(id);
  const newLane = LaneEnum.parse(lane);
  const e = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId } });
  if (e.lane === newLane) return;

  const category: EnquiryCategory | null = newLane === "UNSORTED" ? e.category : newLane;
  const assigneeId = await ownerFor(newLane === "UNSORTED" ? "UNSORTED" : newLane);
  let draftReply = e.draftReply;
  const warnings = [...e.draftWarnings];
  if (!e.draftEdited && category && e.status === "OPEN") {
    const ex = { ...EMPTY_EXTRACTED, ...((e.extracted as Extracted | null) ?? {}) };
    let draft = fallbackDraft(category, ex);
    if (category === "ROOM") {
      const { block } = await buildQuoteBlock(ex);
      draft = insertQuote(draft, block);
    } else draft = insertQuote(draft, "");
    const assignee = assigneeId ? await prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true } }) : null;
    draftReply = signOff(draft, assignee?.name);
    warnings.push(`Draft rewritten from the ${category.toLowerCase()} template after re-routing.`);
  }

  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: {
      lane: newLane,
      category,
      classifiedBy: "staff",
      assigneeId,
      draftReply,
      draftWarnings: warnings,
      gmAlert: e.gmAlert || newLane === "COMPLAINT",
      events: {
        create: [
          { type: "REROUTED", actorId: user.id, data: { from: e.lane, to: newLane, aiCategory: e.category, aiConfidence: e.confidence } },
          ...(newLane === "COMPLAINT" && !e.gmAlert ? [{ type: "GM_ALERT", actorId: user.id, data: { reason: "re-routed to complaints" } }] : []),
        ],
      },
    },
  });
  refresh(enquiryId);
}

export async function assignEnquiry(id: string, form: FormData) {
  const user = await assertStaff();
  const enquiryId = Id.parse(id);
  const assigneeId = Id.parse(form.get("assigneeId"));
  const assignee = await prisma.user.findFirst({ where: { id: assigneeId, role: { in: ["STAFF", "GM"] } } });
  if (!assignee) throw new Error("Not a staff member");
  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: { assigneeId, events: { create: { type: "ASSIGNED", actorId: user.id, data: { to: assignee.name } } } },
  });
  refresh(enquiryId);
}

const DraftSchema = z.string().trim().min(10, "The reply is too short.").max(5000, "The reply is too long.");

export type DraftState = { ok?: boolean; error?: string; savedAt?: number } | undefined;

export async function saveDraft(id: string, _: DraftState, form: FormData): Promise<DraftState> {
  const user = await assertStaff();
  const enquiryId = Id.parse(id);
  const parsed = DraftSchema.safeParse(form.get("draft"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const intent = form.get("intent");

  const e = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId } });
  if (intent === "send") {
    if (e.status !== "OPEN") return { error: "This enquiry has already been answered." };
    const now = new Date();
    const mins = Math.max(0, Math.round((now.getTime() - e.receivedAt.getTime()) / 60_000));
    // Simulated send: in production this calls the email / WhatsApp provider.
    await prisma.enquiry.update({
      where: { id: enquiryId },
      data: {
        status: "REPLIED",
        replyBody: parsed.data,
        draftReply: parsed.data,
        repliedAt: now,
        firstReplyMins: e.firstReplyMins ?? mins,
        events: { create: { type: "REPLIED", actorId: user.id, data: { via: e.channel, simulated: true } } },
      },
    });
  } else {
    await prisma.enquiry.update({
      where: { id: enquiryId },
      data: {
        draftReply: parsed.data,
        draftEdited: true,
        events: { create: { type: "DRAFT_EDITED", actorId: user.id } },
      },
    });
  }
  refresh(enquiryId);
  return { ok: true, savedAt: Date.now() };
}

export async function rerunAi(id: string) {
  const user = await assertStaff();
  const enquiryId = Id.parse(id);
  const e = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId }, select: { status: true } });
  if (e.status !== "OPEN") return;
  await prisma.enquiryEvent.create({ data: { enquiryId, type: "RERUN_AI", actorId: user.id } });
  await routeEnquiry(enquiryId);
  refresh(enquiryId);
}

export async function acknowledgeAlert(id: string) {
  const user = await assertStaff();
  if (user.role !== "GM") throw new Error("Only the GM can acknowledge alerts");
  const enquiryId = Id.parse(id);
  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: { gmAlertAckAt: new Date(), events: { create: { type: "GM_ACK", actorId: user.id } } },
  });
  refresh(enquiryId);
}

export async function setStatus(id: string, status: "OPEN" | "CLOSED") {
  const user = await assertStaff();
  const enquiryId = Id.parse(id);
  z.enum(["OPEN", "CLOSED"]).parse(status);
  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: { status, events: { create: { type: status === "CLOSED" ? "CLOSED" : "REOPENED", actorId: user.id } } },
  });
  refresh(enquiryId);
}

export type SimState = { ok?: boolean; error?: string; reference?: string } | undefined;

/** Staff tool: simulate an email or WhatsApp arriving (same path as the webhooks). */
export async function simulateInbound(_: SimState, form: FormData): Promise<SimState> {
  await assertStaff();
  const channel = z.enum(["EMAIL", "WHATSAPP"]).safeParse(form.get("channel"));
  const parsed = InboundSchema.safeParse({
    fromName: form.get("fromName"),
    fromContact: form.get("fromContact"),
    subject: form.get("subject") || undefined,
    message: form.get("message"),
  });
  if (!channel.success || !parsed.success) return { error: "Fill in who it's from and the message." };
  const e = await createEnquiry({ channel: channel.data, ...parsed.data });
  after(() => routeEnquirySafely(e.id));
  refresh();
  return { ok: true, reference: e.reference };
}
