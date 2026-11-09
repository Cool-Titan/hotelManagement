"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { login, signup, type AuthState } from "@/app/actions/auth";

export function AuthForms({ next, defaultMode }: { next: string; defaultMode: "login" | "signup" }) {
  const [mode, setMode] = useState(defaultMode);
  const [loginState, loginAction, loggingIn] = useActionState<AuthState, FormData>(login, undefined);
  const [signupState, signupAction, signingUp] = useActionState<AuthState, FormData>(signup, undefined);
  const state = mode === "login" ? loginState : signupState;

  return (
    <div className="card mt-8 p-6 sm:p-8">
      <div role="tablist" className="mb-6 grid grid-cols-2 rounded-full bg-paper p-1 text-sm">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`h-9 rounded-full ${mode === m ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}
          >
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form action={mode === "login" ? loginAction : signupAction} className="space-y-4" key={mode}>
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <label className="block">
            <span className="label">Your name</span>
            <input className="input" name="name" autoComplete="name" required defaultValue={state?.fields?.name} />
          </label>
        )}
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" name="email" autoComplete="email" required defaultValue={state?.fields?.email} />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : undefined}
            required
          />
          {mode === "signup" && <span className="mt-1 block text-[12px] text-ink-3">At least 8 characters.</span>}
        </label>
        {state?.error && (
          <p role="alert" className="rounded-lg bg-cherry-soft px-3 py-2 text-sm text-cherry">
            {state.error}
          </p>
        )}
        <button className="btn-primary w-full" disabled={loggingIn || signingUp}>
          {loggingIn || signingUp ? <Loader2 size={16} className="animate-spin" aria-label="Working" /> : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
