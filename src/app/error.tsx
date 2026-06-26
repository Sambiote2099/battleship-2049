"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-deep-navy flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-coral mb-2">Something went wrong</h1>
        <p className="text-mist/60 mb-6">{error.message || "An unexpected error occurred."}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-sea-foam text-deep-navy font-semibold px-6 py-2 hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-sea-foam/40 text-sea-foam px-6 py-2 hover:bg-ocean-blue/40"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}