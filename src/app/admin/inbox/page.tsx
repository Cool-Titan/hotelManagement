import Link from "next/link";
import type { Metadata } from "next";
import type { Lane, Prisma } from "@prisma/client";
import { BellRing, Inbox as InboxIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { daysAgo, timeAgo } from "@/lib/dates";
import { ChannelTag, ConfidenceMeter, LANE_LABEL, LaneBadge } from "@/components/admin/badges";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { SimulateInbound } from "./SimulateInbound";

export const metadata: Metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "unsorted", label: "Unsorted", lane: "UNSORTED" },
  { key: "complaint", label: "Complaints", lane: "COMPLAINT" },
  { key: "room", label: "Rooms", lane: "ROOM" },
  { key: "wedding", label: "Weddings", lane: "WEDDING" },
  { key: "offsite", label: "Offsites", lane: "OFFSITE" },
  { key: "mine", label: "Assigned to me", lane: null },
  { key: "all", label: "All", lane: null },
] as const;

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export default async function InboxPage(props: PageProps<"/admin/inbox">) {
  const user = await requireStaff();
  const sp = await props.searchParams;
  const isGm = user.role === "GM";
  const defaultTab = isGm ? "unsorted" : "mine";
  const tabKey = (typeof sp.tab === "string" && TABS.some((t) => t.key === sp.tab) ? sp.tab : defaultTab) as (typeof TABS)[number]["key"];
  const tab = TABS.find((t) => t.key === tabKey)!;
  const status = sp.status === "done" ? "done" : "open";

  const where: Prisma.EnquiryWhereInput = {
    status: status === "open" ? "OPEN" : { in: ["REPLIED", "CLOSED"] },
    ...(tab.lane ? { lane: tab.lane as Lane } : {}),
    ...(tab.key === "mine" ? { assigneeId: user.id } : {}),
  };

  const weekAgo = daysAgo(7);
  const [items, laneCounts, mineCount, replied, alerts, pending] = await Promise.all([
    prisma.enquiry.findMany({
      where,
      orderBy: [{ receivedAt: status === "open" ? "asc" : "desc" }],
      take: 100,
      include: { assignee: { select: { name: true } } },
    }),
    prisma.enquiry.groupBy({ by: ["lane"], where: { status: "OPEN" }, _count: true }),
    prisma.enquiry.count({ where: { status: "OPEN", assigneeId: user.id } }),
    prisma.enquiry.findMany({ where: { repliedAt: { gte: weekAgo }, firstReplyMins: { not: null } }, select: { firstReplyMins: true } }),
    prisma.enquiry.findMany({ where: { gmAlert: true, gmAlertAckAt: null }, select: { id: true, reference: true, fromName: true, summary: true }, orderBy: { receivedAt: "desc" } }),
    prisma.enquiry.count({ where: { lane: "PENDING" } }),
  ]);
  const count = (lane: Lane) => laneCounts.find((c) => c.lane === lane)?._count ?? 0;
  const openTotal = laneCounts.reduce((a, c) => a + c._count, 0);
  const med = median(replied.map((r) => r.firstReplyMins!));
  const now = new Date();

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <AutoRefresh active={pending > 0} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Enquiries</h1>
          <p className="mt-1 text-sm text-ink-2">Every channel in one place. AI sorts and drafts; you check and send.</p>
        </div>
        <SimulateInbound />
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        {[
          { k: "Open", v: String(openTotal) },
          { k: "Unsorted", v: String(count("UNSORTED")), warn: count("UNSORTED") > 0 },
          { k: "Median first reply (7d)", v: med === null ? "—" : med < 60 ? `${med} min` : `${(med / 60).toFixed(1)} h`, warn: med !== null && med > 30 },
        ].map((m) => (
          <div key={m.k} className="card px-4 py-3">
            <dt className="text-[12px] text-ink-3">{m.k}</dt>
            <dd className={`mt-0.5 text-xl font-medium ${m.warn ? "text-amber" : ""}`}>{m.v}</dd>
          </div>
        ))}
      </dl>

      {isGm && alerts.length > 0 && (
        <div role="alert" className="mt-6 rounded-xl border border-cherry/25 bg-cherry-soft p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-cherry">
            <BellRing size={16} aria-hidden /> {alerts.length} unhappy guest{alerts.length > 1 ? "s" : ""} need{alerts.length === 1 ? "s" : ""} your attention
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.id} className="line-clamp-2">
                <Link href={`/admin/inbox/${a.id}`} className="underline decoration-cherry/40 hover:decoration-cherry">
                  {a.fromName}
                </Link>{" "}
                <span className="text-ink-2">— {a.summary ?? a.reference}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <nav className="-mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Lanes">
        {TABS.map((t) => {
          const n = t.lane ? count(t.lane as Lane) : t.key === "mine" ? mineCount : openTotal;
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`?tab=${t.key}${status === "done" ? "&status=done" : ""}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap ${active ? "border-estate font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[11px] ${t.key === "unsorted" && n > 0 ? "bg-amber-soft text-amber" : t.key === "complaint" && n > 0 ? "bg-cherry-soft text-cherry" : "bg-paper text-ink-3"}`}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1 text-[13px]">
          <Link href={`?tab=${tab.key}`} className={`rounded-full px-3 py-1 ${status === "open" ? "bg-ink text-white" : "text-ink-2 hover:bg-surface"}`}>Open</Link>
          <Link href={`?tab=${tab.key}&status=done`} className={`rounded-full px-3 py-1 ${status === "done" ? "bg-ink text-white" : "text-ink-2 hover:bg-surface"}`}>Replied & closed</Link>
        </div>
        {pending > 0 && <p className="text-[12px] text-ink-3" aria-live="polite">{pending} being classified…</p>}
      </div>

      {items.length === 0 ? (
        <div className="card mt-4 flex flex-col items-center p-12 text-center">
          <InboxIcon size={28} className="text-ink-3" aria-hidden />
          <p className="mt-3 font-medium">{status === "open" ? "Nothing waiting here" : "Nothing here yet"}</p>
          <p className="mt-1 text-sm text-ink-2">
            {tab.key === "unsorted" ? "Everything the AI was unsure about has been sorted." : "New enquiries in this lane will appear here."}
          </p>
        </div>
      ) : (
        <ul className="card mt-4 divide-y divide-line overflow-hidden">
          {items.map((e) => {
            const ageMins = (now.getTime() - e.receivedAt.getTime()) / 60_000;
            const overdue = e.status === "OPEN" && ageMins > 30;
            return (
              <li key={e.id}>
                <Link href={`/admin/inbox/${e.id}`} className="grid gap-1 px-4 py-3.5 hover:bg-paper sm:grid-cols-[1fr_auto] sm:gap-4 sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium">{e.fromName}</span>
                      <ChannelTag channel={e.channel} />
                      <span className="font-mono text-[11px] text-ink-3">{e.reference}</span>
                      {e.gmAlert && !e.gmAlertAckAt && <span className="chip bg-cherry-soft text-cherry"><BellRing size={11} aria-hidden /> GM alerted</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-2">{e.summary ?? e.message}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    {(tab.key === "all" || tab.key === "mine") && <LaneBadge lane={e.lane} />}
                    {e.lane === "UNSORTED" && e.category && <span className="text-[12px] text-ink-3">guess: {LANE_LABEL[e.category === "OTHER" ? "UNSORTED" : e.category]}</span>}
                    <ConfidenceMeter value={e.confidence} />
                    <span className="text-[12px] text-ink-3">{e.assignee?.name ?? "Unassigned"}</span>
                    <span className={`text-[12px] ${overdue ? "font-medium text-amber" : "text-ink-3"}`} title={e.receivedAt.toISOString()}>
                      {timeAgo(e.receivedAt, now)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
