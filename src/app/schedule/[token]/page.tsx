"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, CalendarCheck, Phone } from "lucide-react";
import NativeScheduler from "@/components/booking/NativeScheduler";
import {
  getSchedulePage,
  setInstallDateFromCustomer,
  type SchedulePageData,
} from "@/app/actions/customer-schedule";

// ═══════════════════════════════════════════════════════════════════════════
// Pick Your Install Date — /schedule/[token]
//
// Signed link to one job (deposit paid). The customer picks a date and
// morning/afternoon from the installer's availability — same calendar and
// rules as the booking flow — and it's booked immediately. They can change
// it here until 48 hours before; the installer can reschedule any time from
// the Job Ticket.
// ═══════════════════════════════════════════════════════════════════════════

function prettyDate(date: string, time?: string | null) {
  const d = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return time ? `${d} (${time})` : d;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">{children}</div>
    </div>
  );
}

export default function SchedulePage() {
  const params = useParams();
  const token = params.token as string;

  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "invalid">("loading");
  const [page, setPage] = useState<SchedulePageData | null>(null);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<"morning" | "afternoon" | null>(null);
  const [error, setError] = useState("");

  function load(attempt = 0) {
    getSchedulePage(token).then((r) => {
      // Arrived straight from paying: the deposit can take a few seconds to
      // register, so wait for it before saying it isn't paid.
      if (!r.data && r.depositPending && attempt < 6) {
        setTimeout(() => load(attempt + 1), 2500);
        return;
      }
      if (!r.data) {
        setMessage(r.error || "This link isn't valid.");
        setStatus("invalid");
        return;
      }
      setPage(r.data);
      setEditing(!r.data.currentDate);
      setDate(null);
      setTime(null);
      setStatus("ready");
    });
  }

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleConfirm() {
    if (!date) return;
    setError("");
    setStatus("saving");
    const r = await setInstallDateFromCustomer({ token, date, time });
    if (r.success) {
      setPage((p) => (p ? { ...p, currentDate: date, currentTime: time } : p));
      setEditing(false);
      setStatus("saved");
    } else {
      setError(r.error || "Something went wrong. Please try again.");
      setStatus("ready");
    }
  }

  if (status === "loading") {
    return (
      <Shell>
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-yellow-400" />
      </Shell>
    );
  }

  if (status === "invalid" || !page) {
    return (
      <Shell>
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
          <h1 className="mb-2 text-lg font-bold text-white">Can&apos;t Schedule Online</h1>
          <p className="text-sm text-stone-400">{message}</p>
        </div>
      </Shell>
    );
  }

  const header = (
    <div className="mb-5 flex items-center gap-3">
      {page.installerAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.installerAvatar}
          alt={page.installerName}
          className="h-12 w-12 rounded-full border-2 border-yellow-400/50 object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-800 text-lg font-bold text-yellow-400">
          {page.installerName.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-sm font-bold text-white">{page.installerName}</p>
        <p className="text-xs text-stone-500">Your installer</p>
      </div>
    </div>
  );

  const contactLine = page.installerPhone ? (
    <a
      href={`tel:${page.installerPhone}`}
      className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-yellow-400 hover:text-yellow-300"
    >
      <Phone className="h-3.5 w-3.5" />
      {page.installerPhone}
    </a>
  ) : null;

  // Installer schedules directly — no calendar.
  if (!page.schedulingEnabled) {
    return (
      <Shell>
        {header}
        <h1 className="mb-2 text-xl font-bold text-white">Your Install Date</h1>
        {page.currentDate ? (
          <p className="text-sm text-stone-400">
            You&apos;re booked for <strong className="text-white">{prettyDate(page.currentDate, page.currentTime)}</strong>.
            Contact {page.installerName} to change it.
          </p>
        ) : (
          <p className="text-sm text-stone-400">
            {page.installerName} schedules installs directly and will reach out to set your date.
          </p>
        )}
        {contactLine}
      </Shell>
    );
  }

  // Booked (or just saved) and not changing it.
  if (!editing && page.currentDate) {
    return (
      <Shell>
        {header}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            {status === "saved" ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            ) : (
              <CalendarCheck className="h-8 w-8 text-emerald-400" />
            )}
          </div>
          <h1 className="mb-1 text-xl font-bold text-white">
            {status === "saved" ? "You're Booked!" : "Your Install Date"}
          </h1>
          <p className="mb-1 text-lg font-bold text-yellow-400">{prettyDate(page.currentDate, page.currentTime)}</p>
          <p className="mb-6 text-sm text-stone-400">
            {status === "saved"
              ? `${page.installerName} has been notified. A confirmation is on its way to your email.`
              : `${page.installerName} will see you then.`}
          </p>
          {page.canChange ? (
            <button
              onClick={() => {
                setEditing(true);
                setStatus("ready");
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-stone-200 hover:bg-slate-700"
            >
              Change Date
            </button>
          ) : (
            <p className="text-xs text-stone-500">
              Your install is less than 48 hours away. To change it, contact {page.installerName}.
            </p>
          )}
          {contactLine}
        </div>
      </Shell>
    );
  }

  // Picking a date.
  return (
    <Shell>
      {header}
      <h1 className="mb-1 text-xl font-bold text-white">
        {page.currentDate ? "Pick a New Date" : `${page.customerFirstName ? `${page.customerFirstName}, pick` : "Pick"} your install date`}
      </h1>
      <p className="mb-4 text-sm text-stone-400">
        {page.currentDate
          ? `Currently booked for ${prettyDate(page.currentDate, page.currentTime)}.`
          : `Choose a day and time that works for you. ${page.installerName} will be notified.`}
      </p>

      {page.hasWheels && (
        <div className="mb-3 rounded-lg bg-yellow-400/10 px-3 py-2 text-center text-[11px] font-semibold text-yellow-400">
          Caster add-on: 3 business day lead time applies
        </div>
      )}

      <NativeScheduler
        leadTimeDays={page.leadTimeDays}
        workingDays={page.workingDays}
        blackoutDates={page.blackouts}
        blockAvailability={page.blocks}
        selectedDate={date}
        onSelectDate={(d) => {
          setDate(d);
          setTime(null);
        }}
        timePreference={time}
        onSelectTime={setTime}
      />

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={!date || status === "saving"}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 px-6 py-3.5 text-sm font-black uppercase tracking-wide text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
      >
        {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
        {date ? `Book ${prettyDate(date, time)}` : "Pick a date"}
      </button>

      {page.currentDate && (
        <button
          onClick={() => {
            setEditing(false);
            setError("");
          }}
          className="mt-3 w-full text-center text-xs font-semibold text-stone-500 hover:text-stone-300"
        >
          Keep my current date
        </button>
      )}
    </Shell>
  );
}
