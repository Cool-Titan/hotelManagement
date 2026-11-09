"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Info, Loader2, Send } from "lucide-react";
import { saveDraft, type DraftState } from "@/app/actions/inbox";

export function DraftEditor({
  id,
  draft,
  sent,
  channel,
  hasQuote,
  repliedAt,
}: {
  id: string;
  draft: string;
  sent: boolean;
  channel: string;
  hasQuote: boolean;
  repliedAt: string | null;
}) {
  const [text, setText] = useState(draft);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<DraftState, FormData>(saveDraft.bind(null, id), undefined);
  const dirty = text !== draft;

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (sent) {
    return (
      <>
        <p className="mt-3 text-[13px] text-ink-3">Sent by {channel} · {repliedAt}</p>
        <p className="mt-3 rounded-lg bg-paper p-4 text-[15px] leading-relaxed whitespace-pre-wrap">{draft}</p>
      </>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3">
      <p className="flex gap-2 text-[12px] leading-relaxed text-ink-3">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
        {hasQuote
          ? "Prices in this draft come from today's rate table and website availability — not from the AI."
          : "Drafts are never sent automatically. Read, edit, then send."}
      </p>
      <textarea
        name="draft"
        value={text}
        onChange={(ev) => {
          setText(ev.target.value);
          setConfirming(false);
        }}
        className="input min-h-72 py-3 text-[15px] leading-relaxed"
        aria-label="Reply draft"
        maxLength={5000}
      />
      {state?.error && <p role="alert" className="text-sm text-cherry">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <button name="intent" value="send" className="btn-primary btn-sm" disabled={pending}>
              {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}
              Yes, send by {channel}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary btn-sm" onClick={() => setConfirming(true)} disabled={text.trim().length < 10}>
            <Send size={14} aria-hidden /> Send reply
          </button>
        )}
        <button name="intent" value="save" className="btn-secondary btn-sm" disabled={!dirty || pending}>
          Save draft
        </button>
        <button type="button" onClick={copy} className="btn-ghost btn-sm">
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? "Copied" : "Copy"}
        </button>
        {state?.ok && !dirty && <span className="text-[12px] text-estate" role="status">Saved</span>}
      </div>
      <p className="text-[12px] text-ink-3">Sending is simulated in this build: the reply is recorded and the enquiry is marked replied.</p>
    </form>
  );
}
