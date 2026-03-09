"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h2 className="text-lg font-bold text-white">Something went wrong</h2>
      <p className="mt-2 text-sm text-stone-400">
        An error occurred while loading this page. Please try again.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
        >
          Try Again
        </button>
        <a
          href="/"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
