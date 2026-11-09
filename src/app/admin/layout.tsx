import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-paper md:flex-row">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 md:block md:px-5 md:py-6">
          <Link href="/" className="font-serif text-lg">Kaapi Estate</Link>
          <p className="text-[12px] text-ink-3 md:mt-0.5">Staff desk</p>
        </div>
        <AdminNav />
        <div className="hidden px-5 pt-6 md:absolute md:bottom-6 md:block">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-[12px] text-ink-3">{user.role === "GM" ? "General Manager" : `${(user.team ?? "staff").toLowerCase()} team`}</p>
          <form action={logout}>
            <button className="mt-3 text-[13px] text-ink-2 underline hover:text-ink">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
