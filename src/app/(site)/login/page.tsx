import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/rate-limit";
import { isStaffRole } from "@/lib/session";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AuthForms } from "./AuthForms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined, "");
  const session = await getSession();
  if (session) redirect(next || (isStaffRole(session.role) ? "/admin/inbox" : "/account"));
  const forBooking = sp.reason === "book";

  return (
    <>
      <SiteHeader />
      <div className="container-page flex justify-center py-12 sm:py-20">
        <div className="w-full max-w-md">
          <h1 className="display text-center text-4xl">{forBooking ? "Almost there" : "Welcome back"}</h1>
          <p className="mt-2 text-center text-ink-2">
            {forBooking ? "Sign in or create an account to book. It takes a few seconds, and you can find your trip again any time." : "Sign in to see your trips, or to the staff desk."}
          </p>
          <AuthForms next={next} defaultMode={forBooking ? "signup" : "login"} />
          <div className="mt-8 rounded-xl border border-dashed border-line-2 p-4 text-[13px] text-ink-2">
            <p className="font-medium text-ink">Demo accounts</p>
            <p className="mt-1">Guest: guest@demo.test · Reservations: reservations@demo.test · GM: gm@demo.test</p>
            <p>The password is in deployment.md.</p>
          </div>
        </div>
      </div>
    </>
  );
}
