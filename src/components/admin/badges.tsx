import { Bot, Globe, Mail, MessageCircle, PartyPopper, UserRound, Wrench } from "lucide-react";
import type { Channel, Lane } from "@prisma/client";

export const LANE_LABEL: Record<Lane, string> = {
  PENDING: "Classifying",
  UNSORTED: "Unsorted",
  ROOM: "Rooms",
  WEDDING: "Weddings",
  OFFSITE: "Offsites",
  COMPLAINT: "Complaints",
};

export const LANE_TONE: Record<Lane, string> = {
  PENDING: "bg-paper text-ink-3",
  UNSORTED: "bg-amber-soft text-amber",
  ROOM: "bg-sky-soft text-sky",
  WEDDING: "bg-estate-soft text-estate",
  OFFSITE: "bg-[#efeaf5] text-[#5b4a7a]",
  COMPLAINT: "bg-cherry-soft text-cherry",
};

export function LaneBadge({ lane }: { lane: Lane }) {
  return <span className={`chip ${LANE_TONE[lane]}`}>{LANE_LABEL[lane]}</span>;
}

const CHANNEL: Record<Channel, { label: string; icon: typeof Mail }> = {
  EMAIL: { label: "Email", icon: Mail },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle },
  WEB_FORM: { label: "Web form", icon: Globe },
  EVENT_FORM: { label: "Event form", icon: PartyPopper },
};

export function ChannelTag({ channel }: { channel: Channel }) {
  const { label, icon: Icon } = CHANNEL[channel];
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
      <Icon size={13} aria-hidden /> {label}
    </span>
  );
}

export function SourceTag({ by, model }: { by: string | null; model?: string | null }) {
  if (!by) return null;
  const map = {
    ai: { label: model ? `AI · ${model}` : "AI", icon: Bot, cls: "text-sky" },
    fallback: { label: "Keyword rules (AI unavailable)", icon: Wrench, cls: "text-amber" },
    staff: { label: "Set by staff", icon: UserRound, cls: "text-estate" },
  } as const;
  const v = map[by as keyof typeof map];
  if (!v) return null;
  const Icon = v.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] ${v.cls}`}>
      <Icon size={13} aria-hidden /> {v.label}
    </span>
  );
}

export function ConfidenceMeter({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const tone = value >= 0.7 ? "bg-estate" : value >= 0.5 ? "bg-amber" : "bg-cherry";
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-ink-2" title="How sure the classifier is. Below 70% goes to Unsorted.">
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className={`absolute inset-y-0 left-0 ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      {pct}%
    </span>
  );
}
