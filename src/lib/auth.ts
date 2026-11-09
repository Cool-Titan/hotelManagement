// Data-access-layer auth helpers. Every page and server action that touches
// protected data calls one of these — the proxy is only a first line.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, isStaffRole, signSession, verifySession, type SessionUser } from "./session";

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
});

/** The signed-in user, re-read from the database so deleted/changed users lose access. */
export const getCurrentUser = cache(async () => {
  const s = await getSession();
  if (!s) return null;
  const user = await prisma.user.findUnique({
    where: { id: s.userId },
    select: { id: true, name: true, email: true, phone: true, role: true, team: true },
  });
  return user;
});

export async function requireUser(next = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireStaff(next = "/admin/inbox") {
  const user = await requireUser(next);
  if (!isStaffRole(user.role)) redirect("/?denied=1");
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function assertStaff() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) throw new Error("Not authorised");
  return user;
}

export async function startSession(user: SessionUser) {
  const token = await signSession(user);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
