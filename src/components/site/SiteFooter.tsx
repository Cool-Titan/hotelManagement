import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <div className="container-page grid gap-8 py-12 text-sm text-ink-2 sm:grid-cols-3">
        <div>
          <p className="font-serif text-lg text-ink">Kaapi Estate</p>
          <p className="mt-2 max-w-xs leading-relaxed">
            A working coffee estate near Chikkamagaluru, Karnataka. 64 rooms, 12 villas and lawns for celebrations.
          </p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Visit</p>
          <Link href="/#stay" className="block hover:text-ink">Rooms & villas</Link>
          <Link href="/events" className="block hover:text-ink">Weddings & offsites</Link>
          <Link href="/contact" className="block hover:text-ink">Write to us</Link>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Good to know</p>
          <Link href="/privacy" className="block hover:text-ink">Privacy & your data</Link>
          <Link href="/credits" className="block hover:text-ink">Photo credits</Link>
          <p className="text-ink-3">Demo site · payments are in test mode</p>
        </div>
      </div>
    </footer>
  );
}
