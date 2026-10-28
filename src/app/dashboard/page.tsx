import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { AlertCircle, ChevronRight, Settings } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { loadToday } from "@/lib/server/dashboard-today";
import { siteConfig } from "@/config/site";
import { getInstallerLink } from "@/lib/utils";
import { todayInstallDateKey } from "@/utils/installDate";
import SetupChecklist from "@/components/dashboard/SetupChecklist";
import ActionNudge from "@/components/dashboard/ActionNudge";
import LiveLeaderboard from "@/components/dashboard/LiveLeaderboard";
import NetworkPassiveIncome from "@/components/dashboard/NetworkPassiveIncome";
import PromoBanner from "@/components/dashboard/PromoBanner";
import ProPill from "@/components/dashboard/ProPill";
import TodayJobs from "@/components/dashboard/TodayJobs";

// ═══════════════════════════════════════════════════════════════════════════
// Today — the dashboard home. Rendered on the server from one parallel load
// (lib/server/dashboard-today), so it arrives with real numbers.
//
//   account alerts (only when something blocks getting paid or booked)
//   → stats → jobs that need something → setup / coaching → leaderboard
//
// Tools that used to be tiles here live in the tab bar and under More.
// ═══════════════════════════════════════════════════════════════════════════

interface Alert {
  text: string;
  cta: string;
  href: string;
  tone: "red" | "amber";
}

export default async function TodayPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Last-login stamp after the response is sent — it never delays the page.
  after(async () => {
    await getServiceClient().from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
  });

  const { profile, trial, setup, nudge, revenue, jobsDone, jobs } = await loadToday(user.id);

  const welcomeName = profile?.business_name || profile?.first_name || "Partner";
  const leadLink = profile ? getInstallerLink(profile) : "";

  // One list instead of a stack of banners; worst first.
  const alerts: Alert[] = [];
  if (trial.trialExpired && !trial.softLocked) {
    alerts.push({ text: "Your trial has ended — booking links are paused.", cta: "Subscribe", href: "/upgrade", tone: "red" });
  } else if (trial.softLocked) {
    alerts.push({
      text: `Trial ended — finish your ${trial.activeJobsCount} active ${trial.activeJobsCount === 1 ? "job" : "jobs"}; new bookings are paused.`,
      cta: "Subscribe",
      href: "/upgrade",
      tone: "amber",
    });
  } else if (trial.onTrial && trial.jobCapReached) {
    alerts.push({ text: "All 3 trial jobs used — subscribe to accept new bookings.", cta: "Subscribe", href: "/upgrade", tone: "amber" });
  }
  if (profile && !profile.stripe_account_id) {
    alerts.push({ text: "Connect Stripe so you can get paid.", cta: "Connect", href: "/dashboard/profile", tone: "amber" });
  }
  if (profile && (!profile.city || !profile.state)) {
    alerts.push({ text: "Add your city and state so customers can find you.", cta: "Update", href: "/dashboard/profile", tone: "red" });
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Image
            src={siteConfig.logoPath}
            alt={siteConfig.name}
            width={40}
            height={40}
            className="h-10 w-auto shrink-0 object-contain lg:hidden"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold uppercase tracking-wider text-white">{welcomeName}</h1>
            <p className="text-[11px] text-stone-500">Today</p>
          </div>
          {trial.onTrial ? (
            <Link
              href="/upgrade"
              className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                trial.jobCapReached ? "bg-amber-400/15 text-amber-400" : "bg-purple-400/15 text-purple-400"
              }`}
            >
              {trial.jobCapReached
                ? "Trial · cap reached"
                : `Trial · ${trial.jobsRemaining} ${trial.jobsRemaining === 1 ? "job" : "jobs"} left`}
            </Link>
          ) : (
            <ProPill link={leadLink} />
          )}
          <Link
            href="/dashboard/profile"
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {/* ── Account alerts ── */}
          {alerts.length > 0 && (
            <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {alerts.map((a) => (
                <li key={a.text} className="flex items-center gap-3 px-4 py-3">
                  <AlertCircle className={`h-4 w-4 shrink-0 ${a.tone === "red" ? "text-red-400" : "text-amber-400"}`} />
                  <p className="min-w-0 flex-1 text-xs text-stone-300">{a.text}</p>
                  <Link
                    href={a.href}
                    className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-slate-700"
                  >
                    {a.cta}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* ── Launch pricing (only for installers who aren't Pro yet) ── */}
          {profile && !profile.is_pro && !trial.onTrial && <PromoBanner hasStripeConnected={!!profile.stripe_account_id} />}

          {/* ── Stats ── */}
          <Link
            href="/dashboard/sales"
            className="flex items-center rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 transition hover:border-slate-700"
          >
            <div className="flex flex-1 items-center justify-around">
              <Stat value={`$${revenue.toLocaleString()}`} label="Revenue" />
              <div className="h-6 w-px bg-slate-800" />
              <Stat value={jobsDone} label="Jobs done" />
              <div className="h-6 w-px bg-slate-800" />
              <Stat value={jobs.length} label="Active jobs" />
            </div>
            <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-stone-600" />
          </Link>

          {/* ── Jobs that need something ── */}
          <TodayJobs jobs={jobs} serverToday={todayInstallDateKey()} />

          {/* ── Onboarding, then coaching once onboarding is done ── */}
          {profile && <SetupChecklist userId={profile.id} bookingLink={leadLink} initialStatus={setup} />}
          {profile && (!setup || setup.allComplete || setup.dismissed) && <ActionNudge userId={profile.id} initialNudge={nudge} />}

          {/* ── Network ── */}
          {profile && <LiveLeaderboard userId={profile.id} />}
          {profile && <NetworkPassiveIncome userId={profile.id} />}
        </div>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
    </div>
  );
}
