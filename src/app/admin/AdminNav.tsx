"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Inbox, LogOut, ReceiptText, Tag, Ban } from "lucide-react";
import { logout } from "@/app/actions/auth";

const ITEMS = [
  { href: "/admin/inbox", label: "Enquiries", icon: Inbox },
  { href: "/admin/rates", label: "Rates & allotment", icon: CalendarRange },
  { href: "/admin/blackouts", label: "Blackout dates", icon: Ban },
  { href: "/admin/promos", label: "Promo codes", icon: Tag },
  { href: "/admin/bookings", label: "Bookings & export", icon: ReceiptText },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Staff" className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:px-3 md:pb-0">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${active ? "bg-estate-soft font-medium text-estate" : "text-ink-2 hover:bg-paper hover:text-ink"}`}
          >
            <Icon size={16} aria-hidden /> {label}
          </Link>
        );
      })}
      <form action={logout} className="md:hidden">
        <button className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2" aria-label="Sign out">
          <LogOut size={16} aria-hidden />
        </button>
      </form>
    </nav>
  );
}
