"use client";

import { ArrowLeft } from "lucide-react";
import AvailabilityManager from "@/components/dashboard/AvailabilityManager";
import ProPill from "@/components/dashboard/ProPill";

export default function SchedulePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-stone-400 hover:text-yellow-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <h1 className="flex-1 text-sm font-bold uppercase tracking-wider text-white">
            Schedule Settings
          </h1>
          <ProPill />
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4">
        <AvailabilityManager />

        <div className="mt-8 pb-8 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-yellow-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
