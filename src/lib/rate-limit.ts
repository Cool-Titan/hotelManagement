import "server-only";
import { headers } from "next/headers";

// Fixed-window limiter kept in memory. On serverless this is per instance —
// enough to blunt brute force and form spam for this build (see TDD, "Limits").
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(scope: string, limit: number, windowMs: number): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

/** Only allow same-site relative redirects (blocks open redirects like //evil.com). */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
