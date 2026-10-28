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

function retire() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // private mode — it just shows again next time
  }
}

/**
 * Today: a nudge (same card as the coaching nudge) to turn notifications on.
 * Retired for good on this device once turned on from here or closed with X.
 */
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
    retire();
  };
  const turnOn = async () => {
    await enable();
    // Whatever the browser answered, don't ask again from Today — the
    // Settings switch is there if they change their mind.
    retire();
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-white">Never miss a booking</p>
            <button
              onClick={close}
              aria-label="No thanks"
              title="No thanks"
              className="shrink-0 rounded-lg p-1 text-stone-600 transition-colors hover:bg-slate-800 hover:text-stone-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {state === "needs-install" ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-stone-400">
              On iPhone, tap <Share className="inline h-3 w-3" /> Share → <span className="font-semibold">Add to Home Screen</span>,
              open the app from there, then turn on notifications in Settings.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-[12px] leading-relaxed text-stone-400">
                Get a notification the moment a customer books, pays or opens your quote.
              </p>
              <button
                onClick={turnOn}
                disabled={busy}
                className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-yellow-400 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                Turn on notifications
              </button>
            </>
          )}
        </div>
      </div>
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
