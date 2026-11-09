import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { proxy } from "../src/proxy";
import { signSession, verifySession, SESSION_COOKIE } from "../src/lib/session";
import { safeNext } from "../src/lib/rate-limit";
import { csvCell, toCsv, EXPORT_COLUMNS } from "../src/lib/export";

async function request(path: string, token?: string) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"));
  if (token) req.cookies.set(SESSION_COOKIE, token);
  return proxy(req);
}

describe("sessions", () => {
  it("round-trips a signed session", async () => {
    const t = await signSession({ userId: "u1", role: "STAFF", name: "Priya" });
    expect(await verifySession(t)).toEqual({ userId: "u1", role: "STAFF", name: "Priya" });
  });

  it("rejects tampered, forged and malformed tokens", async () => {
    const t = await signSession({ userId: "u1", role: "GUEST", name: "G" });
    const [h, , s] = t.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "u1", role: "GM" })).toString("base64url");
    expect(await verifySession(`${h}.${forgedPayload}.${s}`)).toBeNull();
    const otherKey = await new SignJWT({ role: "GM" }).setProtectedHeader({ alg: "HS256" }).setSubject("u1").sign(new TextEncoder().encode("x".repeat(40)));
    expect(await verifySession(otherKey)).toBeNull();
    expect(await verifySession("garbage")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });

  it("rejects a token with an unknown role", async () => {
    const key = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const t = await new SignJWT({ role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject("u1").setExpirationTime("1h").sign(key);
    expect(await verifySession(t)).toBeNull();
  });
});

describe("proxy access control", () => {
  it("sends signed-out visitors to sign in, remembering where they were going", async () => {
    const res = await request("/admin/rates?from=2026-12-01");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fadmin%2Frates%3Ffrom%3D2026-12-01");
  });

  it("keeps guests out of the staff desk", async () => {
    const t = await signSession({ userId: "u1", role: "GUEST", name: "G" });
    const res = await request("/admin/inbox", t);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?denied=1");
  });

  it("lets staff and the GM in", async () => {
    for (const role of ["STAFF", "GM"] as const) {
      const t = await signSession({ userId: "u1", role, name: "S" });
      const res = await request("/admin/inbox", t);
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("lets guests into their own account area", async () => {
    const t = await signSession({ userId: "u1", role: "GUEST", name: "G" });
    expect((await request("/account", t)).headers.get("location")).toBeNull();
  });
});

describe("open-redirect protection", () => {
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", 42])("rejects %s", (v) => {
    expect(safeNext(v, "/")).toBe("/");
  });
  it("allows same-site paths", () => expect(safeNext("/book?room=x", "/")).toBe("/book?room=x"));
});

describe("CSV export", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Late arrival, "after 10pm"\nthanks')).toBe('"Late arrival, ""after 10pm""\nthanks"');
  });
  it("neutralises spreadsheet formulas in guest-entered text", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toMatch(/^"'=/);
    expect(csvCell("+91 98450 12345")).toBe("'+91 98450 12345");
    expect(csvCell(-5)).toBe("-5"); // numbers are left alone
  });
  it("writes a header row and one line per booking", () => {
    const row = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, null])) as Parameters<typeof toCsv>[0][number];
    const csv = toCsv([{ ...row, reference: "KE-ABC123", grand_total_inr: 12345 }]);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0].split(",")).toHaveLength(EXPORT_COLUMNS.length);
    expect(lines[1]).toMatch(/^KE-ABC123,/);
  });
});
