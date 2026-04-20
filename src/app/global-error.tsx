"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-950 text-white">
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h2 className="text-lg font-bold">Something went wrong</h2>
          <p className="mt-2 text-sm text-stone-400">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-yellow-400 px-6 py-2 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
