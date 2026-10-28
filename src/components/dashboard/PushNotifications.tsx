"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Share, X } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// What a notification is sent for — kept in one place for both surfaces.
const EVENTS = "new bookings, payments, customers opening your quotes, quote requests and tomorrow's installs";

/** Settings → Account: the on/off switch for this device. */
export function PushSettingsCard() {
  const { state, busy, enable, disable } = usePushNotifications();
  if (state === "loading") return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-2 flex items-center gap-2">
        <Bell className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Notifications</h2>
      </div>
      <p className="mb-4 text-xs text-stone-400">Get a notification on this device for {EVENTS}.</p>

      {state === "on" ? (
        <button
          onClick={disable}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
          Turn off on this device
        </button>
      ) : state === "off" ? (
        <button
          onClick={enable}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold text-slate-950 transition hover:bg-yellow-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          Turn on notifications
        </button>
      ) : (
        <StateHint state={state} />
      )}
    </div>
  );
}

const DISMISS_KEY = "sn-push-prompt-dismissed";

/** Today: a one-time nudge to turn notifications on (hidden once on or dismissed). */
export function PushPrompt() {
  const { state, busy, enable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed || (state !== "off" && state !== "needs-install")) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode — it just shows again next time
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-4">
      <Bell className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">Never miss a booking</p>
        {state === "needs-install" ? (
          <p className="mt-0.5 text-xs text-stone-400">
            On iPhone, tap <Share className="inline h-3 w-3" /> Share → <span className="font-semibold">Add to Home Screen</span>,
            open the app from there, then turn on notifications.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-stone-400">Get notified the moment a customer books, pays or opens your quote.</p>
            <button
              onClick={enable}
              disabled={busy}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-950 transition hover:bg-yellow-300 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
              Turn on
            </button>
          </>
        )}
      </div>
      <button onClick={close} aria-label="Dismiss" className="shrink-0 rounded-lg p-1 text-stone-500 hover:bg-slate-800 hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StateHint({ state }: { state: string }) {
  const text =
    state === "needs-install"
      ? "On iPhone, add the app to your Home Screen (Share → Add to Home Screen), open it from there, then come back here."
      : state === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser's site settings, then reload."
        : "This browser doesn't support notifications.";
  return <p className="rounded-lg bg-slate-800 px-3 py-2.5 text-xs text-stone-400">{text}</p>;
}
