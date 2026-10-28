"use client";


import AvailabilityManager from "@/components/dashboard/AvailabilityManager";
import PageHeader from "@/components/dashboard/PageHeader";

export default function SchedulePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader title="Schedule" subtitle="Work days, availability and blackout dates" back="/dashboard/more" />

      <main className="mx-auto max-w-2xl p-4">
        <AvailabilityManager />
      </main>
    </div>
  );
}
