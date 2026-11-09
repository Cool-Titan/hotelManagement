// Enquiry intake and routing. Every channel (web form, event form, forwarded
// email, WhatsApp) goes through createEnquiry, then routeEnquiry runs the AI.

import "server-only";
import { Prisma, type Channel, type EnquiryCategory } from "@prisma/client";
import { prisma } from "./db";
import { todayIST } from "./dates";
import { randomReference } from "./ids";
import { triage } from "./ai/triage";
import { modelCall } from "./ai/llm";
import { buildQuoteBlock, insertQuote } from "./ai/quote";
import type { Extracted } from "./ai/extract";

export type NewEnquiry = {
  channel: Channel;
  fromName: string;
  fromContact: string;
  subject?: string | null;
  message: string;
  formData?: Record<string, unknown> | null;
  receivedAt?: Date;
};

export async function createEnquiry(input: NewEnquiry) {
  const enquiry = await prisma.enquiry.create({
    data: {
      reference: randomReference("ENQ", 5),
      channel: input.channel,
      fromName: input.fromName,
      fromContact: input.fromContact,
      subject: input.subject ?? null,
      message: input.message,
      formData: (input.formData ?? undefined) as Prisma.InputJsonValue | undefined,
      receivedAt: input.receivedAt ?? new Date(),
      events: { create: { type: "RECEIVED", data: { channel: input.channel } } },
    },
  });
  return enquiry;
}

export async function ownerFor(category: EnquiryCategory | "UNSORTED"): Promise<string | null> {
  if (category === "UNSORTED" || category === "OTHER" || category === "COMPLAINT") {
    const gm = await prisma.user.findFirst({ where: { role: "GM" }, select: { id: true } });
    if (category !== "COMPLAINT") return gm?.id ?? null;
    const rule = await prisma.routingRule.findUnique({ where: { category } });
    return rule?.assigneeId ?? gm?.id ?? null;
  }
  const rule = await prisma.routingRule.findUnique({ where: { category } });
  return rule?.assigneeId ?? null;
}

export function signOff(draft: string, name: string | undefined) {
  const team = "Reservations & Events, Kaapi Estate";
  return draft.replace(/Warm regards,?\s*$/i, "").trim() + `\n\nWarm regards,\n${name ? `${name}\n` : ""}${team}`;
}

/**
 * Classifies, extracts, assigns and drafts. Safe to call more than once
 * (staff can re-run it). Never sends anything.
 */
export async function routeEnquiry(id: string, opts: { useAi?: boolean } = {}) {
  const enquiry = await prisma.enquiry.findUniqueOrThrow({ where: { id } });
  const call = (opts.useAi ?? true) ? modelCall() : null;
  const result = await triage(
    {
      message: enquiry.message,
      subject: enquiry.subject,
      fromName: enquiry.fromName,
      channel: enquiry.channel,
      formData: enquiry.formData as Record<string, unknown> | null,
    },
    { callModel: call, today: todayIST() },
  );

  const warnings = [...result.warnings];
  let draft = result.draftBody;
  if (result.category === "ROOM") {
    const { block, note } = await buildQuoteBlock(result.extracted);
    draft = insertQuote(draft, block);
    if (note) warnings.push(note);
  } else {
    draft = insertQuote(draft, "");
  }

  const assigneeId = await ownerFor(result.lane === "UNSORTED" ? "UNSORTED" : result.category);
  const assignee = assigneeId ? await prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true } }) : null;
  draft = signOff(draft, assignee?.name);

  const alreadyAlerted = enquiry.gmAlert;
  const updated = await prisma.enquiry.update({
    where: { id },
    data: {
      category: result.category,
      lane: result.lane,
      confidence: result.confidence,
      classifiedBy: result.classifiedBy,
      aiModel: result.model,
      summary: result.summary,
      urgency: result.urgency,
      extracted: result.extracted as unknown as Prisma.InputJsonValue,
      draftReply: draft,
      draftWarnings: warnings,
      draftEdited: false,
      gmAlert: alreadyAlerted || result.gmAlert,
      assigneeId,
      events: {
        create: [
          {
            type: result.classifiedBy === "ai" ? "CLASSIFIED" : "CLASSIFY_FAILED",
            data: {
              category: result.category,
              lane: result.lane,
              confidence: Number(result.confidence.toFixed(2)),
              by: result.classifiedBy,
              model: result.model,
              error: result.aiError ?? null,
              missingInfo: result.missingInfo,
            },
          },
          ...(result.gmAlert && !alreadyAlerted ? [{ type: "GM_ALERT", data: { reason: "complaint signal" } }] : []),
        ],
      },
    },
  });
  return updated;
}

/** Routes without ever throwing — used in after() so intake never fails because of the AI. */
export async function routeEnquirySafely(id: string) {
  try {
    await routeEnquiry(id);
  } catch (e) {
    console.error("routeEnquiry failed", id, e);
    const gm = await prisma.user.findFirst({ where: { role: "GM" }, select: { id: true } }).catch(() => null);
    await prisma.enquiry
      .update({
        where: { id },
        data: {
          lane: "UNSORTED",
          assigneeId: gm?.id,
          draftWarnings: ["Automatic routing failed. Please sort this enquiry by hand."],
          events: { create: { type: "CLASSIFY_FAILED", data: { error: String(e).slice(0, 300) } } },
        },
      })
      .catch(() => undefined);
  }
}

export type ExtractedJson = Extracted;
