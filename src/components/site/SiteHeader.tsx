import Link from "next/link";
import { Menu } from "lucide-react";
import { getSession } from "@/lib/auth";
import { isStaffRole } from "@/lib/session";
import { logout } from "@/app/actions/auth";

export async function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const session = await getSession();
  const tone = overlay ? "text-white" : "text-ink";
  const links = [
    { href: "/#stay", label: "Stay" },
    { href: "/events", label: "Weddings & offsites" },
    { href: "/contact", label: "Contact" },
  ];
  return (
    <header className={`${overlay ? "absolute inset-x-0 top-0 z-20" : "border-b border-line bg-paper"}`}>
      <div className={`container-page flex h-16 items-center justify-between ${tone}`}>
        <Link href="/" className="font-serif text-xl tracking-tight">
          Kaapi Estate
        </Link>
        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="opacity-85 hover:opacity-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {session ? (
            <>
              {isStaffRole(session.role) ? (
                <Link href="/admin/inbox" className="hidden opacity-85 hover:opacity-100 sm:inline">
                  Staff desk
                </Link>
              ) : (
                <Link href="/account" className="hidden opacity-85 hover:opacity-100 sm:inline">
                  My trips
                </Link>
              )}
              <form action={logout} className="hidden sm:block">
                <button className="ml-4 opacity-70 hover:opacity-100">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="hidden opacity-85 hover:opacity-100 sm:inline">
              Sign in
            </Link>
          )}
          <details className="relative md:hidden">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full" aria-label="Menu">
              <Menu size={20} />
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-surface p-2 text-ink shadow-lg">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2.5 hover:bg-paper">
                  {l.label}
                </Link>
              ))}
              <div className="my-1 border-t border-line" />
              {session ? (
                <>
                  <Link href={isStaffRole(session.role) ? "/admin/inbox" : "/account"} className="block rounded-lg px-3 py-2.5 hover:bg-paper">
                    {isStaffRole(session.role) ? "Staff desk" : "My trips"}
                  </Link>
                  <form action={logout}>
                    <button className="w-full rounded-lg px-3 py-2.5 text-left text-ink-2 hover:bg-paper">Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="block rounded-lg px-3 py-2.5 hover:bg-paper">
                  Sign in
                </Link>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
