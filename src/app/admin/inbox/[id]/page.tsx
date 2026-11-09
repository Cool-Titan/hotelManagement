import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Lane } from "@prisma/client";
import { AlertTriangle, BellRing, ChevronLeft, RotateCw } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { formatDateTime, formatLong, parseIsoDate, timeAgo } from "@/lib/dates";
import { formatINR } from "@/lib/pricing";
import { ChannelTag, ConfidenceMeter, LANE_LABEL, LANE_TONE, LaneBadge, SourceTag } from "@/components/admin/badges";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { acknowledgeAlert, assignEnquiry, rerouteEnquiry, rerunAi, setStatus } from "@/app/actions/inbox";
import { CONFIDENCE_THRESHOLD } from "@/lib/ai/triage";
import type { Extracted } from "@/lib/ai/extract";
import { DraftEditor } from "./DraftEditor";

export const metadata: Metadata = { title: "Enquiry" };
export const dynamic = "force-dynamic";

const LANES: Lane[] = ["ROOM", "WEDDING", "OFFSITE", "COMPLAINT", "UNSORTED"];

const EVENT_TEXT: Record<string, string> = {
  RECEIVED: "Received",
  CLASSIFIED: "Classified by AI",
  CLASSIFY_FAILED: "AI unavailable — sorted by rules",
  REROUTED: "Re-routed",
  ASSIGNED: "Assigned",
  DRAFT_EDITED: "Draft edited",
  REPLIED: "Reply sent (simulated)",
  GM_ALERT: "GM alerted",
  GM_ACK: "GM acknowledged",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  RERUN_AI: "AI re-run requested",
};

export default async function EnquiryPage(props: PageProps<"/admin/inbox/[id]">) {
  const user = await requireStaff();
  const { id } = await props.params;
  const [e, staff] = await Promise.all([
    prisma.enquiry.findUnique({
      where: { id },
      include: { assignee: true, events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } } },
    }),
    prisma.user.findMany({ where: { role: { in: ["STAFF", "GM"] } }, select: { id: true, name: true, team: true, role: true }, orderBy: { name: "asc" } }),
  ]);
  if (!e) notFound();

  const ex = (e.extracted ?? null) as Extracted | null;
  const form = (e.formData ?? null) as Record<string, unknown> | null;
  const lastClassify = [...e.events].reverse().find((ev) => ev.type === "CLASSIFIED" || ev.type === "CLASSIFY_FAILED");
  const missing = ((lastClassify?.data as { missingInfo?: string[] } | null)?.missingInfo ?? []).filter(Boolean);
  const pending = e.lane === "PENDING";
  const facts: [string, string | null][] = ex
    ? [
        ["Dates", ex.checkIn ? `${formatLong(parseIsoDate(ex.checkIn))}${ex.checkOut ? ` → ${formatLong(parseIsoDate(ex.checkOut))}` : ""}` : ex.dateText],
        ["Nights", ex.nights?.toString() ?? null],
        ["Adults / children", ex.adults !== null || ex.children !== null ? `${ex.adults ?? "?"} / ${ex.children ?? 0}` : null],
        ["Group size", ex.guests?.toString() ?? null],
        ["Budget", ex.budgetInr ? formatINR(ex.budgetInr) : null],
        ["Room preference", ex.roomPreference ? ex.roomPreference.toLowerCase() : null],
      ]
    : [];

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <AutoRefresh active={pending} />
      <Link href="/admin/inbox" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Enquiries
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl">{e.fromName}</h1>
            <LaneBadge lane={e.lane} />
            {e.status !== "OPEN" && <span className="chip bg-paper text-ink-2">{e.status === "REPLIED" ? "Replied" : "Closed"}</span>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-2">
            <ChannelTag channel={e.channel} /> <span>{e.fromContact}</span> <span className="font-mono text-[12px] text-ink-3">{e.reference}</span>
            <span className="text-ink-3">{formatDateTime(e.receivedAt)} · {timeAgo(e.receivedAt)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {e.status === "OPEN" ? (
            <form action={setStatus.bind(null, e.id, "CLOSED")}>
              <button className="btn-ghost btn-sm">Close without reply</button>
            </form>
          ) : (
            <form action={setStatus.bind(null, e.id, "OPEN")}>
              <button className="btn-ghost btn-sm">Reopen</button>
            </form>
          )}
        </div>
      </div>

      {e.gmAlert && !e.gmAlertAckAt && (
        <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cherry/25 bg-cherry-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-cherry">
            <BellRing size={16} aria-hidden /> This guest sounds unhappy. The GM has been alerted.
          </p>
          {user.role === "GM" && (
            <form action={acknowledgeAlert.bind(null, e.id)}>
              <button className="btn-danger btn-sm">I&apos;m on it</button>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="msg">
            <h2 id="msg" className="eyebrow">Message</h2>
            {e.subject && <p className="mt-2 font-medium">{e.subject}</p>}
            <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap">{e.message}</p>
            {form && (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-paper p-3 text-[13px]">
                {Object.entries(form).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-ink-3">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                    <dd>{Array.isArray(v) ? v.join(", ") || "—" : typeof v === "boolean" ? (v ? "yes" : "no") : k === "budgetInr" && typeof v === "number" ? formatINR(v) : String(v ?? "—")}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="card p-5" aria-labelledby="ai">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="ai" className="eyebrow">Routing</h2>
              <SourceTag by={e.classifiedBy} model={e.aiModel} />
            </div>
            {pending ? (
              <div className="mt-4 space-y-2" aria-busy="true">
                <p className="text-sm text-ink-2">Classifying…</p>
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            ) : (
              <>
                {e.summary && <p className="mt-3 text-[15px]">{e.summary}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-ink-2">Best guess:</span>
                  <span className="font-medium">{e.category ? (e.category === "OTHER" ? "Other" : LANE_LABEL[e.category]) : "—"}</span>
                  <ConfidenceMeter value={e.confidence} />
                  {e.urgency === "high" && <span className="chip bg-cherry-soft text-cherry">urgent</span>}
                </div>
                {e.lane === "UNSORTED" && (
                  <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-[13px] text-amber">
                    {e.classifiedBy === "fallback"
                      ? "The AI wasn't available, so this was sorted by keyword rules. Please check and route it."
                      : e.category === "OTHER"
                        ? "Doesn't fit a guest lane. Route it, or close it if no reply is needed."
                        : `Confidence is below ${Math.round(CONFIDENCE_THRESHOLD * 100)}%, so it waits here for a person to decide.`}
                  </p>
                )}

                {facts.some(([, v]) => v) && (
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                    {facts.map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[12px] text-ink-3">{k}</dt>
                        <dd className={v ? "" : "text-ink-3"}>{v ?? "not stated"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {missing.length > 0 && (
                  <p className="mt-4 text-[13px] text-ink-2">
                    <span className="font-medium text-ink">Still need: </span>
                    {missing.join(" · ")}
                  </p>
                )}
                {e.draftWarnings.length > 0 && (
                  <ul className="mt-4 space-y-1">
                    {e.draftWarnings.map((w, i) => (
                      <li key={i} className="flex gap-2 text-[13px] text-amber">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> {w}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <div className="mt-5 border-t border-line pt-4">
              <p className="text-[12px] font-medium text-ink-2">Move to lane</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {LANES.map((l) => (
                  <form key={l} action={rerouteEnquiry.bind(null, e.id, l)}>
                    <button
                      disabled={e.lane === l}
                      aria-pressed={e.lane === l}
                      className={`chip border px-3 py-1.5 text-[13px] ${e.lane === l ? `${LANE_TONE[l]} border-transparent` : "border-line-2 bg-surface text-ink-2 hover:border-ink-3"}`}
                    >
                      {LANE_LABEL[l]}
                    </button>
                  </form>
                ))}
              </div>
              <form action={assignEnquiry.bind(null, e.id)} className="mt-4 flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="text-[12px] font-medium text-ink-2">Owner</span>
                  <select name="assigneeId" defaultValue={e.assigneeId ?? ""} className="input mt-1 h-9 text-sm">
                    <option value="" disabled>Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.role === "GM" ? "GM" : (s.team ?? "").toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn-secondary btn-sm">Assign</button>
              </form>
              {e.status === "OPEN" && (
                <form action={rerunAi.bind(null, e.id)} className="mt-3">
                  <button className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 underline hover:text-ink">
                    <RotateCw size={13} aria-hidden /> Re-run AI classification
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="draft">
            <h2 id="draft" className="eyebrow">{e.status === "REPLIED" ? "Reply sent" : "Reply draft"}</h2>
            {pending ? (
              <div className="mt-4 space-y-2" aria-busy="true">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-5/6" />
                <div className="skeleton h-4 w-4/6" />
              </div>
            ) : (
              <DraftEditor
                key={e.replyBody ?? e.draftReply ?? ""}
                id={e.id}
                draft={e.replyBody ?? e.draftReply ?? ""}
                sent={e.status === "REPLIED"}
                channel={e.channel === "WHATSAPP" ? "WhatsApp" : "email"}
                hasQuote={e.category === "ROOM" && !!ex?.checkIn}
                repliedAt={e.repliedAt ? formatDateTime(e.repliedAt) : null}
              />
            )}
          </section>

          <section className="card p-5" aria-labelledby="hist">
            <h2 id="hist" className="eyebrow">History</h2>
            <ol className="mt-3 space-y-2.5 border-l border-line pl-4">
              {e.events.map((ev) => {
                const d = (ev.data ?? {}) as Record<string, unknown>;
                const detail =
                  ev.type === "CLASSIFIED" || ev.type === "CLASSIFY_FAILED"
                    ? `${String(d.lane ?? "").toLowerCase()}${typeof d.confidence === "number" ? ` · ${Math.round(d.confidence * 100)}%` : ""}${d.error ? ` · ${String(d.error).slice(0, 80)}` : ""}`
                    : ev.type === "REROUTED"
                      ? `${String(d.from).toLowerCase()} → ${String(d.to).toLowerCase()}`
                      : ev.type === "ASSIGNED"
                        ? `to ${String(d.to)}`
                        : ev.type === "RECEIVED"
                          ? String(d.channel ?? "").toLowerCase().replace("_", " ")
                          : "";
                return (
                  <li key={ev.id} className="relative text-[13px]">
                    <span className={`absolute top-1.5 -left-[21px] h-2 w-2 rounded-full ${ev.type === "GM_ALERT" ? "bg-cherry" : "bg-line-2"}`} aria-hidden />
                    <span className="font-medium">{EVENT_TEXT[ev.type] ?? ev.type}</span>
                    {detail && <span className="text-ink-2"> · {detail}</span>}
                    <span className="block text-[12px] text-ink-3">
                      {formatDateTime(ev.createdAt)}
                      {ev.actor ? ` · ${ev.actor.name}` : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
