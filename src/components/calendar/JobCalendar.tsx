"use client";

import { useState, useMemo, useCallback, memo } from "react";
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

// Use string format for date state to avoid Date object comparison issues
function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatFullDate(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function JobCalendar({ scheduledDates, onDateClick }: JobCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  // Store as year-month-day string to avoid Date object issues
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentDay, setCurrentDay] = useState(() => new Date().getDate());

  // Today's date as a stable string
  const todayString = useMemo(() => getTodayString(), []);
  const [todayYear, todayMonth, todayDay] = useMemo(() => {
    const parts = todayString.split("-").map(Number);
    return parts;
  }, [todayString]);

  // Get days for current month view
  const monthDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    const days: ({ year: number; month: number; day: number } | null)[] = [];

    // Add empty slots for days before first of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add all days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ year: currentYear, month: currentMonth, day: d });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Get days for current week view
  const weekDays = useMemo(() => {
    const days: { year: number; month: number; day: number }[] = [];
    const startOfWeek = new Date(currentYear, currentMonth, currentDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push({ year: day.getFullYear(), month: day.getMonth(), day: day.getDate() });
    }

    return days;
  }, [currentYear, currentMonth, currentDay]);

  // Navigation callbacks
  const goNext = useCallback(() => {
    if (viewMode === "month") {
      setCurrentMonth((m) => {
        if (m === 11) {
          setCurrentYear((y) => y + 1);
          return 0;
        }
        return m + 1;
      });
    } else if (viewMode === "week") {
      const newDate = new Date(currentYear, currentMonth, currentDay + 7);
      setCurrentYear(newDate.getFullYear());
      setCurrentMonth(newDate.getMonth());
      setCurrentDay(newDate.getDate());
    } else {
      const newDate = new Date(currentYear, currentMonth, currentDay + 1);
      setCurrentYear(newDate.getFullYear());
      setCurrentMonth(newDate.getMonth());
      setCurrentDay(newDate.getDate());
    }
  }, [viewMode, currentYear, currentMonth, currentDay]);

  const goPrev = useCallback(() => {
    if (viewMode === "month") {
      setCurrentMonth((m) => {
        if (m === 0) {
          setCurrentYear((y) => y - 1);
          return 11;
        }
        return m - 1;
      });
    } else if (viewMode === "week") {
      const newDate = new Date(currentYear, currentMonth, currentDay - 7);
      setCurrentYear(newDate.getFullYear());
      setCurrentMonth(newDate.getMonth());
      setCurrentDay(newDate.getDate());
    } else {
      const newDate = new Date(currentYear, currentMonth, currentDay - 1);
      setCurrentYear(newDate.getFullYear());
      setCurrentMonth(newDate.getMonth());
      setCurrentDay(newDate.getDate());
    }
  }, [viewMode, currentYear, currentMonth, currentDay]);

  const goToday = useCallback(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setCurrentDay(now.getDate());
  }, []);

  const handleDayClick = useCallback((year: number, month: number, day: number) => {
    if (!onDateClick) return;
    const dateKey = formatDateKey(year, month, day);
    const formattedDate = formatFullDate(year, month, day);
    onDateClick(dateKey, formattedDate);
  }, [onDateClick]);

  // Header title
  const headerTitle = useMemo(() => {
    if (viewMode === "month") {
      return `${MONTHS[currentMonth]} ${currentYear}`;
    } else if (viewMode === "week") {
      const startOfWeek = new Date(currentYear, currentMonth, currentDay);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${MONTHS[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      }
      return `${MONTHS[startOfWeek.getMonth()].slice(0, 3)} ${startOfWeek.getDate()} - ${MONTHS[endOfWeek.getMonth()].slice(0, 3)} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    } else {
      const date = new Date(currentYear, currentMonth, currentDay);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  }, [currentYear, currentMonth, currentDay, viewMode]);

  // Render a single day cell
  const renderDayCell = useCallback((dateInfo: { year: number; month: number; day: number } | null) => {
    if (!dateInfo) {
      return <div className="h-12" />;
    }

    const { year, month, day } = dateInfo;
    const dateKey = formatDateKey(year, month, day);
    const jobCount = scheduledDates[dateKey] || 0;
    const isToday = year === todayYear && month === todayMonth && day === todayDay;
    const isPast = new Date(year, month, day) < new Date(todayYear, todayMonth, todayDay);
    const hasJobs = jobCount > 0;

    return (
      <button
        onClick={() => handleDayClick(year, month, day)}
        className={`
          relative flex flex-col items-center justify-center rounded-lg transition-all h-12 w-full
          ${isToday
            ? "bg-yellow-400 text-gray-950 font-bold"
            : isPast
              ? "text-stone-600 hover:bg-slate-800"
              : "text-stone-300 hover:bg-slate-800"
          }
          ${hasJobs && !isToday ? "bg-slate-800" : ""}
        `}
      >
        <span className="text-sm">{day}</span>
        {hasJobs && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold bg-red-500 text-white"
          >
            {jobCount}
          </span>
        )}
      </button>
    );
  }, [scheduledDates, todayYear, todayMonth, todayDay, handleDayClick]);

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
            {monthDays.map((dateInfo, i) => (
              <div key={i}>{renderDayCell(dateInfo)}</div>
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
            {weekDays.map((dateInfo, i) => (
              <div key={i} className="flex justify-center">
                {renderDayCell(dateInfo)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === "day" && (
        <div className="text-center">
          <div className="mx-auto w-20">
            {renderDayCell({ year: currentYear, month: currentMonth, day: currentDay })}
          </div>
          <p className="mt-3 text-sm text-stone-400">
            {scheduledDates[formatDateKey(currentYear, currentMonth, currentDay)]
              ? `${scheduledDates[formatDateKey(currentYear, currentMonth, currentDay)]} job(s) scheduled`
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

export default memo(JobCalendar);
