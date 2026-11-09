"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  name: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[12px] text-ink-3">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-[13px] text-cherry">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ pending, children, pendingText, className = "btn-primary" }: { pending: boolean; children: ReactNode; pendingText: string; className?: string }) {
  return (
    <button className={className} disabled={pending}>
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" aria-hidden /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Invisible field that bots fill in and people don't. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="rounded-lg bg-cherry-soft px-4 py-3 text-sm text-cherry">
      {message}
    </p>
  ) : null;
}
