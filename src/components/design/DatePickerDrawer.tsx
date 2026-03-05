"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// DatePickerDrawer — Modern slide-in drawer from the right
//
// Minimal calendar grid, brand yellow selected-date indicator,
// frosted glass backdrop. Used in the final checkout phase.
// ═══════════════════════════════════════════════════════════════════════════

interface DatePickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  selectedDate?: Date | null;
  /** Days that are blacked out / unavailable */
  disabledDates?: Date[];
  /** Minimum selectable date (defaults to today) */
  minDate?: Date;
  /** Working days (e.g., ["Mon", "Tue", "Wed", "Thu", "Fri"]) */
  workingDays?: string[];
  /** Lead time in business days */
  leadTimeDays?: number;
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addBusinessDays(start: Date, days: number, workingDayNums: number[]): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (workingDayNums.includes(result.getDay())) {
      added++;
    }
  }
  return result;
}

export default function DatePickerDrawer({
  isOpen,
  onClose,
  onSelectDate,
  selectedDate = null,
  disabledDates = [],
  minDate,
  workingDays = ["Mon", "Tue", "Wed", "Thu", "Fri"],
  leadTimeDays = 5,
}: DatePickerDrawerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const workingDayNums = useMemo(
    () => workingDays.map((d) => DAY_MAP[d] ?? -1).filter((n) => n >= 0),
    [workingDays]
  );

  const effectiveMinDate = useMemo(() => {
    if (minDate) return minDate;
    return addBusinessDays(today, leadTimeDays, workingDayNums);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate, leadTimeDays, workingDayNums]);

  const [viewMonth, setViewMonth] = useState(effectiveMinDate.getMonth());
  const [viewYear, setViewYear] = useState(effectiveMinDate.getFullYear());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

  const isDisabled = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    date.setHours(0, 0, 0, 0);
    if (date < effectiveMinDate) return true;
    if (!workingDayNums.includes(date.getDay())) return true;
    return disabledDates.some((d) => isSameDay(d, date));
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const date = new Date(viewYear, viewMonth, day);
    return isSameDay(date, selectedDate);
  };

  const isToday = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    return isSameDay(date, today);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (day: number) => {
    if (isDisabled(day)) return;
    const date = new Date(viewYear, viewMonth, day);
    onSelectDate(date);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          />

          {/* Drawer — slides in from right */}
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-zinc-950 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-400">
                  <CalendarDays className="h-5 w-5 text-zinc-900" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Pick a Date</h2>
                  <p className="text-[10px] text-zinc-500">
                    Choose your preferred installation date
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Calendar Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {/* Month Navigation */}
              <div className="mb-6 flex items-center justify-between">
                <button
                  onClick={prevMonth}
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="text-sm font-bold tracking-wide text-white">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </h3>
                <button
                  onClick={nextMonth}
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Day Labels */}
              <div className="mb-2 grid grid-cols-7 gap-1">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const disabled = isDisabled(day);
                  const selected = isSelected(day);
                  const todayMark = isToday(day);

                  return (
                    <motion.button
                      key={day}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleDayClick(day)}
                      className={`relative flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        selected
                          ? "bg-yellow-400 text-zinc-900 font-bold shadow-lg shadow-yellow-400/20"
                          : disabled
                          ? "text-zinc-700 cursor-not-allowed"
                          : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      }`}
                      whileHover={!disabled && !selected ? { scale: 1.08 } : {}}
                      whileTap={!disabled ? { scale: 0.95 } : {}}
                    >
                      {day}
                      {todayMark && !selected && (
                        <div className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-yellow-400" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 flex items-center gap-4 text-[10px] text-zinc-600">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  Selected
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                  Unavailable
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-1 rounded-full bg-yellow-400" />
                  Today
                </div>
              </div>

              {/* Selected date info */}
              {selectedDate && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-center"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/60">
                    Selected Date
                  </p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div
              className="shrink-0 border-t border-zinc-800 px-6 py-4"
              style={{
                background: "linear-gradient(to top, rgba(9,9,11,0.95), rgba(9,9,11,0.85))",
                backdropFilter: "blur(20px)",
              }}
            >
              <motion.button
                onClick={onClose}
                disabled={!selectedDate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:opacity-40"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <CalendarDays className="h-4 w-4" />
                Confirm Date
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
