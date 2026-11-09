"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { endSession, startSession } from "@/lib/auth";
import { isStaffRole } from "@/lib/session";
import { rateLimit, safeNext } from "@/lib/rate-limit";

// Compared against when the email is unknown, so timing does not reveal accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export type AuthState = { error?: string; fields?: Record<string, string> } | undefined;

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
});

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const fields = { email: String(form.get("email") ?? "") };
  if (!(await rateLimit("login", 10, 10 * 60_000))) return { error: "Too many attempts. Please wait a few minutes.", fields };
  const parsed = LoginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Same message and similar timing whether the email exists or not.
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "That email and password don't match.", fields };

  await startSession({ userId: user.id, role: user.role, name: user.name });
  const fallback = isStaffRole(user.role) ? "/admin/inbox" : "/account";
  let next = safeNext(form.get("next"), fallback);
  if (next.startsWith("/admin") && !isStaffRole(user.role)) next = "/account";
  redirect(next);
}

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const fields = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  if (!(await rateLimit("signup", 5, 10 * 60_000))) return { error: "Too many attempts. Please wait a few minutes.", fields };
  const parsed = SignupSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "An account with this email already exists. Sign in instead.", fields };

  // Self sign-up always creates a guest. Staff accounts are created by the GM.
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "GUEST",
    },
  });
  await startSession({ userId: user.id, role: user.role, name: user.name });
  redirect(safeNext(form.get("next"), "/account"));
}

export async function logout() {
  await endSession();
  redirect("/");
}
