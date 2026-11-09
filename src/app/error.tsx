"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="display mt-2 text-4xl">That didn&apos;t load</h1>
      <p className="mt-3 max-w-md text-ink-2">
        It may be a weak connection, or a problem on our side. Nothing was charged.
        {error.digest ? <span className="mt-2 block font-mono text-[12px] text-ink-3">Ref {error.digest}</span> : null}
      </p>
      <button onClick={reset} className="btn-primary mt-6">Try again</button>
    </div>
  );
}
