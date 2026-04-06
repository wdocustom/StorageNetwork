"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Loader2, Plus, Trash2, X, Check, CalendarX2, Mail } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  getBlackoutDates,
  addBlackoutDate,
  removeBlackoutDate,
  type BlackoutDate,
} from "@/app/actions/blackout-dates";

// ═══════════════════════════════════════════════════════════════════════════
// AvailabilityManager — Weekly availability + blackout date scheduler
// ═══════════════════════════════════════════════════════════════════════════

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DEFAULT_WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function AvailabilityManager() {
  const supabase = getSupabaseBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [dates, setDates] = useState<BlackoutDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Scheduling toggle
  const [schedulingEnabled, setSchedulingEnabled] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);

  // Weekly availability
  const [workingDays, setWorkingDays] = useState<string[]>(DEFAULT_WORKING_DAYS);
  const [savingDays, setSavingDays] = useState(false);
  const [daysSaved, setDaysSaved] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Load blackout dates
    const result = await getBlackoutDates(user.id);
    if (result.success) setDates(result.dates);

    // Load working days and scheduling toggle from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("working_days, scheduling_enabled")
      .eq("id", user.id)
      .single();
    if (profile?.working_days && Array.isArray(profile.working_days)) {
      setWorkingDays(profile.working_days);
    }
    if (profile && typeof profile.scheduling_enabled === "boolean") {
      setSchedulingEnabled(profile.scheduling_enabled);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleDay(day: string) {
    const next = workingDays.includes(day)
      ? workingDays.filter((d) => d !== day)
      : [...workingDays, day];

    // Require at least one working day
    if (next.length === 0) return;

    setWorkingDays(next);
    setSavingDays(true);
    setDaysSaved(false);

    if (userId) {
      await supabase
        .from("profiles")
        .update({ working_days: next })
        .eq("id", userId);
    }

    setSavingDays(false);
    setDaysSaved(true);
    setTimeout(() => setDaysSaved(false), 1500);
  }

  async function handleAdd() {
    if (!startDate || !endDate || !userId) return;
    setSaving(true);
    const result = await addBlackoutDate(userId, startDate, endDate, reason);
    setSaving(false);
    if (result.success) {
      setShowForm(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      load();
    }
  }

  async function handleRemove(id: string) {
    if (!userId) return;
    setDeleting(id);
    await removeBlackoutDate(userId, id);
    setDeleting(null);
    load();
  }

  const today = new Date().toISOString().split("T")[0];

  // Filter to only show future/current blackout dates
  const activeDates = dates.filter((d) => d.end_date >= today);
  const pastDates = dates.filter((d) => d.end_date < today);

  function formatDate(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
      </div>
    );
  }

  async function toggleScheduling() {
    if (!userId) return;
    setSavingToggle(true);
    const next = !schedulingEnabled;
    setSchedulingEnabled(next);
    await supabase
      .from("profiles")
      .update({ scheduling_enabled: next })
      .eq("id", userId);
    setSavingToggle(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Scheduling Toggle ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {schedulingEnabled ? (
                <CalendarOff className="h-4 w-4 text-stone-500" />
              ) : (
                <Mail className="h-4 w-4 text-yellow-400" />
              )}
              <h3 className="text-sm font-bold text-white">Customer Scheduling</h3>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              {schedulingEnabled
                ? "Customers pick their own installation date during checkout."
                : "Scheduling is off — customers skip the calendar and you coordinate the date directly via email after they book."}
            </p>
          </div>
          <button
            onClick={toggleScheduling}
            disabled={savingToggle}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              schedulingEnabled ? "bg-yellow-400" : "bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                schedulingEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* ── Weekly Availability ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Weekly Availability</h3>
            <p className="text-[11px] text-stone-500">
              Click / Highlight the days you want to work — the booking calendar will disable the others
            </p>
          </div>
          {savingDays && <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />}
          {daysSaved && <Check className="h-4 w-4 text-emerald-400" />}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {ALL_DAYS.map((day) => {
            const active = workingDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`rounded-lg py-2.5 text-center text-xs font-bold uppercase tracking-wider transition-all ${
                  active
                    ? "border border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                    : "border border-slate-700 bg-slate-800 text-stone-600"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Blackout Dates ──────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Blackout Dates</h3>
            <p className="text-[11px] text-stone-500">
              Block dates when you&apos;re unavailable for installations
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-lg bg-yellow-400/10 px-3 py-1.5 text-xs font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
          >
            {showForm ? (
              <>
                <X className="h-3.5 w-3.5" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add Dates
              </>
            )}
          </button>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  min={today}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || today}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Vacation, personal day, etc."
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!startDate || !endDate || saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-500 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-yellow-400 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CalendarOff className="h-4 w-4" />
                  Block These Dates
                </>
              )}
            </button>
          </div>
        )}

        {/* List */}
        {activeDates.length === 0 && !showForm ? (
          <div className="rounded-xl border border-dashed border-slate-700 py-8 text-center">
            <CalendarOff className="mx-auto mb-2 h-8 w-8 text-stone-600" />
            <p className="text-sm text-stone-500">No blackout dates set</p>
            <p className="text-[11px] text-stone-600">
              You&apos;re available every working day
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeDates.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-white">
                    {formatDate(d.start_date)}
                    {d.start_date !== d.end_date && ` — ${formatDate(d.end_date)}`}
                  </p>
                  {d.reason && (
                    <p className="text-[11px] text-stone-500">{d.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(d.id)}
                  disabled={deleting === d.id}
                  className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  {deleting === d.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
            {pastDates.length > 0 && (
              <p className="pt-2 text-center text-[10px] text-stone-600">
                {pastDates.length} past blackout{pastDates.length !== 1 ? "s" : ""} hidden
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
