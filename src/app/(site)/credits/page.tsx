import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";
import credits from "@/data/photo-credits.json";

export const metadata: Metadata = { title: "Photo credits" };

export default function CreditsPage() {
  return (
    <>
      <SiteHeader />
      <div className="container-page max-w-2xl py-12 sm:py-20">
        <h1 className="display text-4xl">Photo credits</h1>
        <p className="mt-3 text-ink-2">
          This demo uses free-licence photographs. They illustrate the experience and are not photos of the actual property.
        </p>
        <ul className="mt-8 divide-y divide-line border-y border-line text-sm">
          {credits.map((c) => (
            <li key={c.slot} className="flex flex-wrap justify-between gap-2 py-3">
              <span className="text-ink-2">{c.slot}</span>
              <a href={c.pageUrl} className="underline" target="_blank" rel="noopener noreferrer">
                {c.photographer} on {c.source}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
