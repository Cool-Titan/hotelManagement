"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Smartphone, Timer } from "lucide-react";
import { abandonBooking, payForBooking, type PayState } from "@/app/actions/booking";
import { formatINR } from "@/lib/pricing";

function useCountdown(expiresAt: string) {
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(expiresAt) - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Date.parse(expiresAt) - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return left;
}

export function PaymentForm({ reference, amount, expiresAt }: { reference: string; amount: number; expiresAt: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<"card" | "upi">("card");
  const [state, action, pending] = useActionState<PayState, FormData>(payForBooking.bind(null, reference), undefined);
  const left = useCountdown(expiresAt);
  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const expired = left <= 0;

  useEffect(() => {
    if (expired) router.refresh(); // server releases the hold and shows the expired state
  }, [expired, router]);

  return (
    <div className="mt-8 space-y-6">
      <p
        className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${mins < 3 ? "bg-amber-soft text-amber" : "bg-estate-soft text-estate"}`}
        role="timer"
        aria-live="off"
      >
        <Timer size={16} aria-hidden />
        {expired ? "Your hold has ended." : `Your room is held for ${mins}:${String(secs).padStart(2, "0")}`}
      </p>

      <div role="tablist" className="grid grid-cols-2 gap-2" aria-label="Payment method">
        {([
          ["card", "Card", CreditCard],
          ["upi", "UPI", Smartphone],
        ] as const).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={method === m}
            onClick={() => setMethod(m)}
            className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium ${method === m ? "border-estate bg-surface text-ink" : "border-line text-ink-2 hover:border-line-2"}`}
          >
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <form action={action} className="card space-y-4 p-5">
        <input type="hidden" name="method" value={method} />
        {method === "card" ? (
          <>
            <label className="block">
              <span className="label">Card number</span>
              <input className="input font-mono tracking-wider" name="card" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" required />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="label">Expiry</span>
                <input className="input" name="expiry" placeholder="MM/YY" autoComplete="off" required />
              </label>
              <label className="block">
                <span className="label">CVC</span>
                <input className="input" name="cvc" inputMode="numeric" placeholder="123" autoComplete="off" required />
              </label>
            </div>
            <div className="rounded-lg bg-paper p-3 text-[12px] leading-relaxed text-ink-2">
              <p className="font-medium text-ink">Test cards</p>
              <p><span className="font-mono">4242 4242 4242 4242</span> pays successfully</p>
              <p><span className="font-mono">4000 0000 0000 0002</span> is declined</p>
              <p><span className="font-mono">4000 0000 0000 9995</span> has insufficient funds</p>
              <p>Any future expiry, any 3-digit CVC.</p>
            </div>
          </>
        ) : (
          <>
            <label className="block">
              <span className="label">UPI ID</span>
              <input className="input" name="vpa" placeholder="name@okbank" autoComplete="off" required />
            </label>
            <p className="rounded-lg bg-paper p-3 text-[12px] text-ink-2">
              Test mode: any UPI ID succeeds, except one starting with <span className="font-mono">fail</span>.
            </p>
          </>
        )}

        {state?.error && (
          <p role="alert" className="rounded-lg bg-cherry-soft px-4 py-3 text-sm text-cherry">
            {state.error}
          </p>
        )}

        <button className="btn-primary w-full" disabled={pending || expired}>
          {pending ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden /> Processing…
            </>
          ) : (
            `Pay ${formatINR(amount)}`
          )}
        </button>
      </form>

      <form action={abandonBooking.bind(null, reference)}>
        <button className="btn-ghost btn-sm">Cancel and release the room</button>
      </form>
    </div>
  );
}
