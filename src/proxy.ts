import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isStaffRole, verifySession } from "./lib/session";

// First line of access control: bounce unauthenticated visitors before the
// page renders. Pages and actions re-check with the database (lib/auth.ts).
export async function proxy(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = req.nextUrl;

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && !isStaffRole(session.role)) {
    return NextResponse.redirect(new URL("/?denied=1", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
