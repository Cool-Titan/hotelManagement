import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-2 text-4xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-ink-2">It may have moved, or the link may be incomplete.</p>
      <Link href="/" className="btn-primary mt-6">Back to the estate</Link>
    </div>
  );
}
