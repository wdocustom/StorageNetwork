"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// NativeScheduler — Installer-Aware Calendar Picker
//
// Blocks off dates within the installer's lead_time_days window and only
// allows selection on their working_days. No external calendar dependency.
// ═══════════════════════════════════════════════════════════════════════════

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface NativeSchedulerProps {
  /** Installer's required lead time in days (default 5) */
  leadTimeDays?: number;
  /** Installer's working days, e.g. ["Mon", "Tue", "Wed", "Thu", "Fri"] */
  workingDays?: string[];
  /** Currently selected date */
  selectedDate: string | null;
  /** Callback when a date is selected (ISO date string YYYY-MM-DD) */
  onSelectDate: (date: string) => void;
}

export default function NativeScheduler({
  leadTimeDays = 5,
  workingDays = ["Mon", "Tue", "Wed", "Thu", "Fri"],
  selectedDate,
  onSelectDate,
}: NativeSchedulerProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  // Earliest bookable date = today + lead_time_days
  const firstAvailable = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + leadTimeDays);
    return d;
  }, [today, leadTimeDays]);

  // Working day set for quick lookup (convert to JS day indices)
  const workingDayIndices = useMemo(() => {
    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return new Set(workingDays.map((d) => map[d] ?? -1));
  }, [workingDays]);

  // Auto-select first available date on mount
  useEffect(() => {
    if (selectedDate) return; // already selected
    const d = new Date(firstAvailable);
    // Walk forward until we find a working day (max 30 day scan)
    for (let i = 0; i < 30; i++) {
      if (workingDayIndices.has(d.getDay())) {
        onSelectDate(toDateStr(d));
        // Ensure calendar shows this month
        setViewMonth(d.getMonth());
        setViewYear(d.getFullYear());
        return;
      }
      d.setDate(d.getDate() + 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build calendar grid for current view month
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startDay = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: Array<{
      date: Date;
      dayOfMonth: number;
      isCurrentMonth: boolean;
      isAvailable: boolean;
      isSelected: boolean;
      isToday: boolean;
      dateStr: string;
    }> = [];

    // Previous month padding
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
      days.push({
        date: d,
        dayOfMonth: prevMonthDays - i,
        isCurrentMonth: false,
        isAvailable: false,
        isSelected: false,
        isToday: false,
        dateStr: toDateStr(d),
      });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const dateStr = toDateStr(d);
      const isPastLeadTime = d >= firstAvailable;
      const isWorkDay = workingDayIndices.has(d.getDay());
      days.push({
        date: d,
        dayOfMonth: day,
        isCurrentMonth: true,
        isAvailable: isPastLeadTime && isWorkDay,
        isSelected: dateStr === selectedDate,
        isToday: d.getTime() === today.getTime(),
        dateStr,
      });
    }

    // Next month padding to fill 6 rows
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      days.push({
        date: d,
        dayOfMonth: i,
        isCurrentMonth: false,
        isAvailable: false,
        isSelected: false,
        isToday: false,
        dateStr: toDateStr(d),
      });
    }

    return days;
  }, [viewYear, viewMonth, firstAvailable, workingDayIndices, selectedDate, today]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  // Don't allow navigating to past months
  const canGoPrev = viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      {/* Header */}
      <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">
        <Calendar className="h-3 w-3 text-yellow-400" />
        Select Installation Date
      </div>
      <p className="mb-4 text-[11px] text-stone-600">
        Earliest available: {firstAvailable.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        {" "}({leadTimeDays}-day lead time)
      </p>

      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-white">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-0">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-stone-600"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {calendarDays.map((day, i) => (
          <button
            key={i}
            onClick={() => day.isAvailable && onSelectDate(day.dateStr)}
            disabled={!day.isAvailable}
            className={`
              relative flex h-10 items-center justify-center rounded-lg text-sm transition-all
              ${!day.isCurrentMonth ? "text-slate-700" : ""}
              ${day.isAvailable && !day.isSelected
                ? "font-semibold text-white hover:bg-yellow-400/20 hover:text-yellow-400"
                : ""}
              ${day.isCurrentMonth && !day.isAvailable
                ? "text-stone-700 cursor-not-allowed"
                : ""}
              ${day.isSelected
                ? "bg-yellow-400 font-bold text-slate-900 shadow-lg shadow-yellow-400/20"
                : ""}
              ${day.isToday && !day.isSelected
                ? "ring-1 ring-inset ring-slate-600"
                : ""}
            `}
          >
            {day.dayOfMonth}
          </button>
        ))}
      </div>

      {/* Selected date display */}
      {selectedDate && (
        <div className="mt-3 rounded-lg bg-yellow-400/10 px-3 py-2 text-center">
          <span className="text-xs font-bold text-yellow-400">
            Scheduled:{" "}
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      )}
    </div>
  );
}

/** Format Date to YYYY-MM-DD string */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
