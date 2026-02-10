"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, CalendarRange } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// JobCalendar — Interactive calendar for scheduled jobs
// ═══════════════════════════════════════════════════════════════════════════

type ViewMode = "month" | "week" | "day";

interface JobCalendarProps {
  scheduledDates: Record<string, number>; // dateKey (YYYY-MM-DD) -> job count
  onDateClick?: (dateKey: string, formattedDate: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

export default function JobCalendar({ scheduledDates, onDateClick }: JobCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Get days for current month view
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: (Date | null)[] = [];

    // Add empty slots for days before first of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add all days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  }, [currentDate]);

  // Get days for current week view
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }

    return days;
  }, [currentDate]);

  // Navigation
  function goNext() {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  }

  function goPrev() {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  function handleDayClick(date: Date | null) {
    if (!date || !onDateClick) return;
    const dateKey = formatDateKey(date);
    const formattedDate = formatFullDate(date);
    onDateClick(dateKey, formattedDate);
  }

  // Render helpers
  function renderDayCell(date: Date | null, isCompact = false) {
    if (!date) {
      return <div className={isCompact ? "h-10" : "h-12"} />;
    }

    const dateKey = formatDateKey(date);
    const jobCount = scheduledDates[dateKey] || 0;
    const isToday = date.getTime() === today.getTime();
    const isPast = date < today;
    const hasJobs = jobCount > 0;

    return (
      <button
        onClick={() => handleDayClick(date)}
        className={`
          relative flex flex-col items-center justify-center rounded-lg transition-all
          ${isCompact ? "h-10 w-10" : "h-12 w-full"}
          ${isToday
            ? "bg-yellow-400 text-gray-950 font-bold"
            : isPast
              ? "text-stone-600 hover:bg-slate-800"
              : "text-stone-300 hover:bg-slate-800"
          }
          ${hasJobs && !isToday ? "bg-slate-800" : ""}
        `}
      >
        <span className={isCompact ? "text-sm" : "text-sm"}>{date.getDate()}</span>
        {hasJobs && (
          <span
            className={`
              absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center
              rounded-full px-1 text-[10px] font-bold
              ${isToday ? "bg-red-500 text-white" : "bg-red-500 text-white"}
            `}
          >
            {jobCount}
          </span>
        )}
      </button>
    );
  }

  // Header title
  const headerTitle = useMemo(() => {
    if (viewMode === "month") {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === "week") {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${MONTHS[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      }
      return `${MONTHS[startOfWeek.getMonth()].slice(0, 3)} ${startOfWeek.getDate()} - ${MONTHS[endOfWeek.getMonth()].slice(0, 3)} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  }, [currentDate, viewMode]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goNext}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <h3 className="ml-2 text-sm font-bold text-white">{headerTitle}</h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={goToday}
            className="mr-2 rounded-lg bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase text-stone-400 transition-colors hover:text-white"
          >
            Today
          </button>

          {/* View Mode Toggle */}
          <button
            onClick={() => setViewMode("day")}
            className={`rounded-lg p-1.5 transition-colors ${
              viewMode === "day"
                ? "bg-yellow-400/20 text-yellow-400"
                : "text-stone-500 hover:bg-slate-800 hover:text-stone-300"
            }`}
            title="Day view"
          >
            <Calendar className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`rounded-lg p-1.5 transition-colors ${
              viewMode === "week"
                ? "bg-yellow-400/20 text-yellow-400"
                : "text-stone-500 hover:bg-slate-800 hover:text-stone-300"
            }`}
            title="Week view"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`rounded-lg p-1.5 transition-colors ${
              viewMode === "month"
                ? "bg-yellow-400/20 text-yellow-400"
                : "text-stone-500 hover:bg-slate-800 hover:text-stone-300"
            }`}
            title="Month view"
          >
            <CalendarRange className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Month View */}
      {viewMode === "month" && (
        <div>
          {/* Day Headers */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-[10px] font-bold uppercase text-stone-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((date, i) => (
              <div key={i}>{renderDayCell(date)}</div>
            ))}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <div>
          {/* Day Headers */}
          <div className="mb-2 grid grid-cols-7 gap-2">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-[10px] font-bold uppercase text-stone-500">
                {day}
              </div>
            ))}
          </div>

          {/* Week Grid */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((date, i) => (
              <div key={i} className="flex justify-center">
                {renderDayCell(date, false)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === "day" && (
        <div className="text-center">
          <div className="mx-auto w-20">
            {renderDayCell(currentDate, false)}
          </div>
          <p className="mt-3 text-sm text-stone-400">
            {scheduledDates[formatDateKey(currentDate)]
              ? `${scheduledDates[formatDateKey(currentDate)]} job(s) scheduled`
              : "No jobs scheduled"
            }
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-stone-500">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-yellow-400" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative h-3 w-3 rounded bg-slate-800">
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 text-[6px] text-white" />
          </div>
          <span>Has Jobs</span>
        </div>
      </div>
    </div>
  );
}
