import { Check } from "lucide-react";

const STEPS = ["Room & dates", "Your details", "Payment"];

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 text-[13px] sm:gap-4" aria-label="Booking steps">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={s} className="flex items-center gap-2 sm:gap-4" aria-current={active ? "step" : undefined}>
            <span className={`flex items-center gap-2 ${active ? "text-ink" : "text-ink-3"}`}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                  done ? "bg-estate text-white" : active ? "border border-estate text-estate" : "border border-line-2"
                }`}
              >
                {done ? <Check size={13} /> : n}
              </span>
              <span className={active ? "font-medium" : "hidden sm:inline"}>{s}</span>
            </span>
            {n < STEPS.length && <span className="h-px w-5 bg-line-2 sm:w-10" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
