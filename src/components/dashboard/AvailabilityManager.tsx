"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  Sun,
  Sunset,
  Users,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { invalidateInstallerCache } from "@/app/actions/profile";
import {
  getScheduleOverrides,
  setScheduleOverride,
  removeScheduleOverride,
  getScheduledJobs,
  type ScheduleOverride,
  type ScheduledJob,
} from "@/app/actions/schedule-overrides";
import {
  getBlackoutDates,
  type BlackoutDate,
} from "@/app/actions/blackout-dates";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DEFAULT_WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isInBlackout(dateStr: string, blackouts: BlackoutDate[]): boolean {
  return blackouts.some(b => dateStr >= b.start_date && dateStr <= b.end_date);
}

export default function AvailabilityManager() {
  const supabase = getSupabaseBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile settings
  const [schedulingEnabled, setSchedulingEnabled] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [workingDays, setWorkingDays] = useState<string[]>(DEFAULT_WORKING_DAYS);
  const [savingDays, setSavingDays] = useState(false);
  const [daysSaved, setDaysSaved] = useState(false);

  // Calendar data
  const [weekOffset, setWeekOffset] = useState(0);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [blackouts, setBlackouts] = useState<BlackoutDate[]>([]);
  const [savingBlock, setSavingBlock] = useState<string | null>(null);

  // Compute the 14-day window based on weekOffset
  const { windowStart, windowEnd, days } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Start from the beginning of the current week (Sunday) + offset
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    const endOfRange = addDays(startOfWeek, 13);

    const dayList: { date: Date; dateStr: string; dayName: string; isToday: boolean; isPast: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(startOfWeek, i);
      const ds = toDateStr(d);
      dayList.push({
        date: d,
        dateStr: ds,
        dayName: ALL_DAYS[d.getDay()],
        isToday: ds === toDateStr(today),
        isPast: d < today,
      });
    }

    return {
      windowStart: toDateStr(startOfWeek),
      windowEnd: toDateStr(endOfRange),
      days: dayList,
    };
  }, [weekOffset]);

  // Load all data
  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [profileRes, overridesRes, jobsRes, blackoutsRes] = await Promise.all([
      supabase.from("profiles").select("working_days, scheduling_enabled").eq("id", user.id).single(),
      getScheduleOverrides(user.id, windowStart, windowEnd),
      getScheduledJobs(user.id, windowStart, windowEnd),
      getBlackoutDates(user.id),
    ]);

    if (profileRes.data?.working_days && Array.isArray(profileRes.data.working_days)) {
      setWorkingDays(profileRes.data.working_days);
    }
    if (profileRes.data && typeof profileRes.data.scheduling_enabled === "boolean") {
      setSchedulingEnabled(profileRes.data.scheduling_enabled);
    }
    if (overridesRes.success) setOverrides(overridesRes.overrides);
    if (jobsRes.success) setJobs(jobsRes.jobs);
    if (blackoutsRes.success) setBlackouts(blackoutsRes.dates);

    setLoading(false);
  }, [supabase, windowStart, windowEnd]);

  useEffect(() => { loadData(); }, [loadData]);

  // Get override for a date, or derive defaults
  function getBlockState(dateStr: string, dayName: string) {
    const blackedOut = isInBlackout(dateStr, blackouts);
    const isWorkDay = workingDays.includes(dayName);
    const override = overrides.find(o => o.date === dateStr);

    if (blackedOut) return { morning: false, afternoon: false, isBlackout: true, hasOverride: false };
    if (!isWorkDay && !override) return { morning: false, afternoon: false, isBlackout: false, hasOverride: false };
    if (override) {
      return {
        morning: override.morning_available,
        afternoon: override.afternoon_available,
        isBlackout: false,
        hasOverride: true,
      };
    }
    return { morning: true, afternoon: true, isBlackout: false, hasOverride: false };
  }

  // Get jobs for a specific date
  function getJobsForDate(dateStr: string): ScheduledJob[] {
    return jobs.filter(j => j.scheduled_at?.startsWith(dateStr));
  }

  // Toggle a time block
  async function toggleBlock(dateStr: string, dayName: string, block: "morning" | "afternoon") {
    if (!userId) return;
    const key = `${dateStr}-${block}`;
    setSavingBlock(key);

    const state = getBlockState(dateStr, dayName);
    const newMorning = block === "morning" ? !state.morning : state.morning;
    const newAfternoon = block === "afternoon" ? !state.afternoon : state.afternoon;

    // If reverting to default (working day with both blocks on), remove override
    const isWorkDay = workingDays.includes(dayName);
    if (isWorkDay && newMorning && newAfternoon) {
      await removeScheduleOverride(userId, dateStr);
    } else {
      await setScheduleOverride(userId, dateStr, newMorning, newAfternoon);
    }

    // Optimistic update
    setOverrides(prev => {
      const without = prev.filter(o => o.date !== dateStr);
      if (isWorkDay && newMorning && newAfternoon) return without;
      return [...without, { id: key, date: dateStr, morning_available: newMorning, afternoon_available: newAfternoon, note: null }];
    });

    await invalidateInstallerCache(userId);
    setSavingBlock(null);
  }

  // Toggle full day (both blocks at once)
  async function toggleFullDay(dateStr: string, dayName: string) {
    if (!userId) return;
    setSavingBlock(`${dateStr}-full`);

    const state = getBlockState(dateStr, dayName);
    const isCurrentlyAvailable = state.morning || state.afternoon;

    if (isCurrentlyAvailable) {
      // Turn off both blocks
      await setScheduleOverride(userId, dateStr, false, false);
      setOverrides(prev => {
        const without = prev.filter(o => o.date !== dateStr);
        return [...without, { id: dateStr, date: dateStr, morning_available: false, afternoon_available: false, note: null }];
      });
    } else {
      // Turn on both blocks — if it's a working day, remove override; otherwise set both on
      const isWorkDay = workingDays.includes(dayName);
      if (isWorkDay) {
        await removeScheduleOverride(userId, dateStr);
        setOverrides(prev => prev.filter(o => o.date !== dateStr));
      } else {
        await setScheduleOverride(userId, dateStr, true, true);
        setOverrides(prev => {
          const without = prev.filter(o => o.date !== dateStr);
          return [...without, { id: dateStr, date: dateStr, morning_available: true, afternoon_available: true, note: null }];
        });
      }
    }

    await invalidateInstallerCache(userId);
    setSavingBlock(null);
  }

  async function toggleDay(day: string) {
    const next = workingDays.includes(day)
      ? workingDays.filter((d) => d !== day)
      : [...workingDays, day];
    if (next.length === 0) return;

    setWorkingDays(next);
    setSavingDays(true);
    setDaysSaved(false);

    if (userId) {
      await supabase.from("profiles").update({ working_days: next }).eq("id", userId);
      await invalidateInstallerCache(userId);
    }

    setSavingDays(false);
    setDaysSaved(true);
    setTimeout(() => setDaysSaved(false), 1500);
  }

  async function toggleScheduling() {
    if (!userId) return;
    setSavingToggle(true);
    const next = !schedulingEnabled;
    setSchedulingEnabled(next);
    await supabase.from("profiles").update({ scheduling_enabled: next }).eq("id", userId);
    await invalidateInstallerCache(userId);
    setSavingToggle(false);
  }

  // Week navigation label
  const weekLabel = useMemo(() => {
    if (days.length === 0) return "";
    const start = days[0].date;
    const end = days[13].date;
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()} – ${end.getDate()}`;
    }
    return `${start.toLocaleDateString("en-US", { month: "short" })} ${start.getDate()} – ${end.toLocaleDateString("en-US", { month: "short" })} ${end.getDate()}`;
  }, [days]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Scheduling Toggle ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              {schedulingEnabled ? (
                <Clock className="h-4 w-4 text-yellow-400" />
              ) : (
                <Mail className="h-4 w-4 text-stone-500" />
              )}
              <h3 className="text-sm font-bold text-white">Customer Scheduling</h3>
            </div>
            <p className="text-[11px] leading-relaxed text-stone-500">
              {schedulingEnabled
                ? "Customers pick their installation date & time block during checkout."
                : "Scheduling is off — you coordinate the date directly after booking."}
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

      {/* ── Default Work Days ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Default Work Days</h3>
            <p className="text-[11px] text-stone-500">Your recurring weekly pattern</p>
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

      {/* ── 2-Week Visual Calendar ────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900">
        {/* Week navigation */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <button
            onClick={() => setWeekOffset(Math.max(weekOffset - 2, 0))}
            disabled={weekOffset === 0}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <h3 className="text-sm font-bold text-white">{weekLabel}</h3>
            <p className="text-[10px] text-stone-500">Tap blocks to toggle availability</p>
          </div>
          <button
            onClick={() => setWeekOffset(weekOffset + 2)}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day rows */}
        <div className="divide-y divide-slate-800/50">
          {days.map((day) => {
            const state = getBlockState(day.dateStr, day.dayName);
            const dayJobs = getJobsForDate(day.dateStr);
            const morningJobs = dayJobs.filter(j => j.time_preference === "morning");
            const afternoonJobs = dayJobs.filter(j => j.time_preference === "afternoon");
            const anyTimeJobs = dayJobs.filter(j => !j.time_preference);
            const totalWeight = dayJobs.reduce((sum, j) => sum + (j.weight || 1), 0);
            const isOff = !state.morning && !state.afternoon;
            const isSaving = savingBlock?.startsWith(day.dateStr);

            return (
              <div
                key={day.dateStr}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  day.isPast ? "opacity-40" : ""
                } ${day.isToday ? "bg-yellow-400/5" : ""}`}
              >
                {/* Date label */}
                <button
                  onClick={() => !day.isPast && !state.isBlackout && toggleFullDay(day.dateStr, day.dayName)}
                  disabled={day.isPast || state.isBlackout}
                  className={`flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5 transition-all ${
                    day.isToday
                      ? "bg-yellow-400 text-slate-900"
                      : isOff
                        ? "bg-slate-800/50 text-stone-600"
                        : "bg-slate-800 text-stone-300"
                  } ${!day.isPast && !state.isBlackout ? "hover:ring-1 hover:ring-yellow-400/30" : ""}`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider">
                    {day.dayName}
                  </span>
                  <span className={`text-lg font-black leading-tight ${day.isToday ? "text-slate-900" : ""}`}>
                    {day.date.getDate()}
                  </span>
                </button>

                {/* Time blocks */}
                {state.isBlackout ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 py-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                      <CalendarOff className="h-3 w-3" />
                      Blackout
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-1 gap-2">
                    {/* Morning block */}
                    <button
                      onClick={() => !day.isPast && toggleBlock(day.dateStr, day.dayName, "morning")}
                      disabled={day.isPast || isSaving}
                      className={`group relative flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${
                        state.morning
                          ? "border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400/50"
                          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                      }`}
                    >
                      <Sun className={`h-3.5 w-3.5 shrink-0 ${state.morning ? "text-emerald-400" : "text-stone-600"}`} />
                      <div className="min-w-0 flex-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          state.morning ? "text-emerald-400" : "text-stone-600"
                        }`}>
                          AM
                        </span>
                        {(morningJobs.length > 0 || (anyTimeJobs.length > 0 && afternoonJobs.length === 0)) && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <Users className="h-2.5 w-2.5 text-yellow-400" />
                            <span className="truncate text-[9px] text-yellow-400">
                              {morningJobs.length > 0
                                ? morningJobs.map(j => j.customer_name.split(" ")[0]).join(", ")
                                : `${anyTimeJobs.length} job${anyTimeJobs.length > 1 ? "s" : ""}`}
                            </span>
                          </div>
                        )}
                      </div>
                      {savingBlock === `${day.dateStr}-morning` && (
                        <Loader2 className="absolute right-2 top-2 h-3 w-3 animate-spin text-stone-500" />
                      )}
                    </button>

                    {/* Afternoon block */}
                    <button
                      onClick={() => !day.isPast && toggleBlock(day.dateStr, day.dayName, "afternoon")}
                      disabled={day.isPast || isSaving}
                      className={`group relative flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${
                        state.afternoon
                          ? "border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400/50"
                          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                      }`}
                    >
                      <Sunset className={`h-3.5 w-3.5 shrink-0 ${state.afternoon ? "text-emerald-400" : "text-stone-600"}`} />
                      <div className="min-w-0 flex-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          state.afternoon ? "text-emerald-400" : "text-stone-600"
                        }`}>
                          PM
                        </span>
                        {(afternoonJobs.length > 0 || (anyTimeJobs.length > 0 && morningJobs.length === 0 && afternoonJobs.length === 0)) && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <Users className="h-2.5 w-2.5 text-yellow-400" />
                            <span className="truncate text-[9px] text-yellow-400">
                              {afternoonJobs.length > 0
                                ? afternoonJobs.map(j => j.customer_name.split(" ")[0]).join(", ")
                                : anyTimeJobs.length > 0 && morningJobs.length === 0
                                  ? `${anyTimeJobs.length} job${anyTimeJobs.length > 1 ? "s" : ""}`
                                  : ""}
                            </span>
                          </div>
                        )}
                      </div>
                      {savingBlock === `${day.dateStr}-afternoon` && (
                        <Loader2 className="absolute right-2 top-2 h-3 w-3 animate-spin text-stone-500" />
                      )}
                    </button>
                  </div>
                )}

                {/* Capacity indicator */}
                {totalWeight > 0 && !state.isBlackout && (
                  <div className="flex shrink-0 flex-col items-center">
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`h-1.5 w-1.5 rounded-full ${
                            i <= totalWeight ? "bg-yellow-400" : "bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="mt-0.5 text-[8px] font-bold text-stone-600">{totalWeight}/3</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-800 px-4 py-3">
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <div className="h-2.5 w-2.5 rounded border border-emerald-500/30 bg-emerald-500/10" />
            Available
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <div className="h-2.5 w-2.5 rounded border border-slate-700 bg-slate-800/50" />
            Off
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <div className="flex gap-0.5">
              <div className="h-2 w-2 rounded-full bg-yellow-400" />
              <div className="h-2 w-2 rounded-full bg-slate-700" />
              <div className="h-2 w-2 rounded-full bg-slate-700" />
            </div>
            Capacity
          </span>
        </div>
      </div>
    </div>
  );
}
