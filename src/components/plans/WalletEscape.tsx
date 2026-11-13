"use client";

// ═══════════════════════════════════════════════════════════════════════════
// "Buy with Apple Pay / Google Pay" for visitors inside Facebook / Instagram
//
// Those apps' browsers hide the wallets, so this reopens the designer in
// Safari (iOS) or Chrome (Android) with the same design, the buyer's
// analytics id and ?pay=1, which opens the payment form on arrival — the
// wallet button is then one tap away. If the app blocks the jump, the manual
// steps and a copy-link button appear after a moment.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

import { appLabel, externalBrowserUrl, walletFor, type InAppBrowser } from "@/lib/in-app-browser";
import { trackPlanEvent } from "@/lib/plan-events";

function AppleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 384 512" className={className} aria-hidden fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function WalletEscape({
  inApp,
  buildUrl,
  variant = "button",
}: {
  inApp: InAppBrowser;
  /** Absolute https URL to reopen: this designer with the current design */
  buildUrl: () => string;
  /** "button": full-width wallet button; "bar": slim notice inside the payment panel */
  variant?: "button" | "bar";
}) {
  const wallet = walletFor(inApp.os);
  const [help, setHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!wallet) return null;
  const app = appLabel(inApp.app);

  const go = () => {
    const url = buildUrl();
    const external = externalBrowserUrl(url, inApp.os);
    trackPlanEvent("wallet_escape", `${inApp.app}-${inApp.os}`);
    if (external) window.location.href = external;
    // Still here after a moment: the app didn't hand off. Show the manual way.
    timer.current = setTimeout(() => {
      if (document.visibilityState === "visible") {
        setHelp(true);
        trackPlanEvent("wallet_fallback", `${inApp.app}-${inApp.os}`);
      }
    }, 2500);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildUrl());
      setCopied(true);
    } catch {
      /* clipboard blocked: the steps above still work */
    }
  };

  const Mark = inApp.os === "ios" ? AppleMark : GoogleMark;

  const helpBox = help && (
    <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-left text-xs text-stone-300">
      <p className="font-semibold text-white">Didn&apos;t open {wallet.browser}?</p>
      <p className="mt-1">
        Tap the <strong className="text-white">•••</strong> menu at the top of {app}&apos;s browser, then{" "}
        <strong className="text-white">Open in external browser</strong>. Your design comes with you.
      </p>
      <button
        type="button"
        onClick={copy}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 font-semibold text-stone-200 hover:bg-slate-800"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? `Copied — paste it in ${wallet.browser}` : "Copy link"}
      </button>
    </div>
  );

  if (variant === "bar") {
    return (
      <div className="border-b border-slate-800 bg-slate-950 px-4 py-2.5">
        <button
          type="button"
          onClick={go}
          className="flex w-full items-center gap-2 text-left text-xs text-stone-300"
        >
          <Mark className="h-4 w-4 shrink-0 text-white" />
          <span className="flex-1">
            {wallet.name} isn&apos;t available inside {app}.{" "}
            <span className="font-bold text-yellow-300 underline">Pay in {wallet.browser}</span>
          </span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stone-500" />
        </button>
        {helpBox}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-base font-bold text-black shadow-lg transition hover:bg-stone-100 active:scale-[0.99]"
      >
        Buy with <Mark className="h-5 w-5" /> Pay
      </button>
      <p className="mt-1.5 text-center text-[11px] text-stone-500">
        Opens {wallet.browser} with your design · {app} hides {wallet.name}
      </p>
      {helpBox}
    </div>
  );
}
