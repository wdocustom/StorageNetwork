"use client";

import Link from "next/link";
import Image from "next/image";
import { LogOut, Wrench } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// ═══════════════════════════════════════════════════════════════════════════
// RealtorPortalHeader — small top bar rendered by the (authed) layout so
// every realtor-portal page gets a sign-out + logo home link for free.
// Mirrors the installer dashboard's header pattern (src/app/dashboard/page.tsx).
//
// Dual-role users (realtor + installer Pro / Stripe-connected) get an
// "Installer dashboard" switcher; the layout passes `hasInstallerSide`
// after checking the profile, so the link only renders when there's
// actually something to switch to.
// ═══════════════════════════════════════════════════════════════════════════

interface RealtorPortalHeaderProps {
  hasInstallerSide?: boolean;
}

export function RealtorPortalHeader({ hasInstallerSide = false }: RealtorPortalHeaderProps) {
  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/realtors/login";
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/realtors/dashboard" className="flex items-center gap-2.5">
          <Image
            src="/landing_page_logo.png"
            alt="Storage Network"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-sm font-bold tracking-tight text-white">
            Realtor Portal
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {hasInstallerSide && (
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-stone-400 transition-colors hover:bg-slate-800 hover:text-white sm:flex"
              title="Switch to installer dashboard"
            >
              <Wrench className="h-3.5 w-3.5" />
              Installer view
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
