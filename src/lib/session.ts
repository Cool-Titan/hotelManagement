// Session token: a signed JWT (HS256) in an httpOnly cookie. Kept free of
// server-only imports so the proxy can verify it too.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ke_session";
export const SESSION_DAYS = 7;

export type Role = "GUEST" | "STAFF" | "GM";
export type SessionUser = { userId: string; role: Role; name: string };

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (!payload.sub || (role !== "GUEST" && role !== "STAFF" && role !== "GM")) return null;
    return { userId: payload.sub, role, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

export const isStaffRole = (r: Role) => r === "STAFF" || r === "GM";
