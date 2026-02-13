import type { Metadata } from "next";
import { Suspense } from "react";
import BuildManualPage from "./BuildManualPage";

export const metadata: Metadata = {
  title: "Assembly Manual | Storage Network",
  description:
    "Step-by-step assembly instructions, cut plans, and shopping lists for your custom tote storage unit.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
            <p className="text-sm text-stone-400">Loading assembly manual…</p>
          </div>
        </div>
      }
    >
      <BuildManualPage />
    </Suspense>
  );
}
