"use client";

// ═══════════════════════════════════════════════════════════════════════════
// "Keep your plans on your phone" — shown on the plan page after purchase
//
// Every phone does this differently, so the card adapts:
//   Android Chrome / desktop Chrome & Edge  real install prompt (beforeinstallprompt)
//   iPhone Safari                           the 3 taps (Share → Add to Home Screen → Add);
//                                           Apple doesn't let a page add itself
//   Facebook / Instagram's browser          can't add to the home screen: reopen
//                                           in Safari / Chrome first
//   Other phones                            the browser-menu steps
//   Computers                               bookmark (⌘D / Ctrl+D) + copy link
//
// The icon opens "My Plans" (the buyer's library), not the installer
// dashboard: this page swaps the site's manifest for /api/plans/manifest.
// Hidden when already opened from the home screen, or once dismissed.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { Bookmark, Check, Copy, ExternalLink, Plus, Share, Smartphone, SquarePlus, X } from "lucide-react";

import { appLabel, detectInAppBrowser, detectOs, externalBrowserUrl, type InAppBrowser, type MobileOs } from "@/lib/in-app-browser";
import { trackPlanEvent } from "@/lib/plan-events";

const DISMISS_KEY = "sn_plan_home_dismissed";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "prompt" | "ios" | "in-app" | "android-menu" | "desktop";

export default function SaveToHomeScreen({ token }: { token: string }) {
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [os, setOs] = useState<MobileOs>("other");
  const [inApp, setInApp] = useState<InAppBrowser | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [steps, setSteps] = useState(false);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // Opened from the home screen already: nothing to offer.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    setHidden(standalone || dismissed);

    const ua = navigator.userAgent;
    setOs(detectOs(ua));
    setInApp(detectInAppBrowser(ua));
    setIsMac(/Mac/i.test(navigator.platform || ua));

    // The home-screen icon should open the buyer's plans, not the installer app.
    const manifestHref = `/api/plans/manifest?token=${encodeURIComponent(token)}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previousManifest = link?.getAttribute("href") ?? null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = manifestHref;
    const title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const previousTitle = title?.content ?? null;
    if (title) title.content = "My Plans";

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setAdded(true);
      trackPlanEvent("save_home_added", "installed");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    setReady(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (link && previousManifest) link.href = previousManifest;
      if (title && previousTitle) title.content = previousTitle;
    };
  }, [token]);

  if (!ready || hidden) return null;

  const mobile = os === "ios" || os === "android";
  const mode: Mode = inApp && mobile
    ? "in-app"
    : installEvent
      ? "prompt"
      : os === "ios"
        ? "ios"
        : os === "android"
          ? "android-menu"
          : "desktop";
  const browser = os === "ios" ? "Safari" : "Chrome";

  const dismiss = () => {
    trackPlanEvent("save_home", "dismiss");
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked */
    }
    setHidden(true);
  };

  const install = async () => {
    if (!installEvent) return;
    trackPlanEvent("save_home", "prompt");
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setAdded(true);
      trackPlanEvent("save_home_added", "prompt");
    }
    setInstallEvent(null);
  };

  const openExternal = () => {
    trackPlanEvent("save_home", "in_app");
    const url = externalBrowserUrl(window.location.href, os);
    if (url) window.location.href = url;
    setSteps(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      /* clipboard blocked */
    }
  };

  const primary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-gray-950 transition hover:bg-yellow-300";
  const step = "flex items-start gap-3 text-sm text-stone-300";
  const num = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-gray-950";

  if (added) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
        <Check className="h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-sm text-emerald-200">
          Added. Your plans are one tap away: look for <strong>My Plans</strong> on your home screen.
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-slate-900 to-slate-950 p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-3 top-3 rounded-lg p-1.5 text-stone-500 hover:bg-slate-800 hover:text-stone-300"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
          {mode === "desktop" ? <Bookmark className="h-6 w-6 text-yellow-400" /> : <Smartphone className="h-6 w-6 text-yellow-400" />}
        </div>
        <div className="min-w-0">
          <p className="text-base font-black text-white">
            {mode === "desktop" ? "Bookmark your plans" : "Keep your plans on your phone"}
          </p>
          <p className="mt-0.5 text-sm text-stone-400">
            {mode === "desktop"
              ? "Come back to your 3D guide, cut list and PDF any time, without digging through email."
              : "Add My Plans to your home screen: one tap to your 3D guide and cut list in the garage, no digging through email."}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {mode === "prompt" && (
          <button type="button" onClick={install} className={primary}>
            <Plus className="h-4 w-4" /> Add to Home Screen
          </button>
        )}

        {mode === "ios" &&
          (steps ? (
            <ol className="space-y-3">
              <li className={step}>
                <span className={num}>1</span>
                <span>
                  Tap <Share className="mx-0.5 inline h-4 w-4 -translate-y-0.5 text-sky-400" aria-label="Share" /> <strong className="text-white">Share</strong> in
                  Safari. On newer iPhones it&apos;s inside <strong className="text-white">•••</strong> at the bottom right.
                </span>
              </li>
              <li className={step}>
                <span className={num}>2</span>
                <span>
                  Scroll down and tap <SquarePlus className="mx-0.5 inline h-4 w-4 -translate-y-0.5 text-white" aria-hidden />{" "}
                  <strong className="text-white">Add to Home Screen</strong>.
                </span>
              </li>
              <li className={step}>
                <span className={num}>3</span>
                <span>
                  Tap <strong className="text-white">Add</strong>. My Plans appears on your home screen.
                </span>
              </li>
            </ol>
          ) : (
            <button
              type="button"
              onClick={() => {
                trackPlanEvent("save_home", "ios_steps");
                setSteps(true);
              }}
              className={primary}
            >
              <Plus className="h-4 w-4" /> Add to Home Screen
            </button>
          ))}

        {mode === "android-menu" && (
          <ol className="space-y-3">
            <li className={step}>
              <span className={num}>1</span>
              <span>
                Tap your browser&apos;s menu (<strong className="text-white">⋮</strong> or <strong className="text-white">≡</strong>).
              </span>
            </li>
            <li className={step}>
              <span className={num}>2</span>
              <span>
                Tap <strong className="text-white">Add to Home screen</strong> (or <strong className="text-white">Install app</strong>), then{" "}
                <strong className="text-white">Add</strong>.
              </span>
            </li>
          </ol>
        )}

        {mode === "in-app" && inApp && (
          <div>
            <button type="button" onClick={openExternal} className={primary}>
              <ExternalLink className="h-4 w-4" /> Open in {browser} to add it
            </button>
            <p className="mt-2 text-xs text-stone-500">
              {appLabel(inApp.app)}&apos;s browser can&apos;t add pages to your home screen.
              {steps && (
                <>
                  {" "}
                  Didn&apos;t open? Tap <strong className="text-stone-300">•••</strong> at the top, then{" "}
                  <strong className="text-stone-300">Open in external browser</strong>.
                </>
              )}
            </p>
          </div>
        )}

        {mode === "desktop" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-stone-300">
              Press{" "}
              <kbd className="rounded-md border border-slate-600 bg-slate-800 px-2 py-0.5 font-mono text-xs text-white">
                {isMac ? "⌘ D" : "Ctrl D"}
              </kbd>{" "}
              to bookmark this page.
            </p>
            <button
              type="button"
              onClick={() => {
                trackPlanEvent("save_home", "copy");
                copy();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-stone-200 hover:bg-slate-800"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
