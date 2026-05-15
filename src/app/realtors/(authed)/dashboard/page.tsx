// ═══════════════════════════════════════════════════════════════════════════
// Realtor Dashboard — Phase A1 shell
//
// This is the landing page realtors hit after signup. In A1 it's an empty
// state pointing at what's coming. A2 adds the package picker and gift
// flow. A3 adds gift history + installer-fulfillment status.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Gift, Package, Settings } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { AnalyticsSection } from "./AnalyticsSection";
import { RecentActivitySection } from "./RecentActivitySection";
import { ReferralsSection } from "./ReferralsSection";
import { ToteInventorySection } from "./ToteInventorySection";
import {
  getRealtorToteInventory,
  listTotePackOptions,
  verifyTotePackPurchase,
} from "@/app/actions/realtor-tote-inventory";

export default async function RealtorDashboardPage({
  searchParams,
}: {
  searchParams?: { tote_purchase?: string; session_id?: string };
}) {
  // Layout already guarantees we're a realtor; this read is just for the
  // friendly greeting + brokerage on the page.
  const user = await getAuthenticatedUser();
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, realtor_brokerage")
    .eq("id", user!.id)
    .single();

  // Returning from Stripe Checkout with ?tote_purchase=success — finalize
  // synchronously here so the inventory tile renders the new balance even
  // if the webhook hasn't fired yet. Idempotent: a second call (webhook)
  // returns alreadyFinalized=true.
  if (searchParams?.tote_purchase === "success" && searchParams?.session_id) {
    await verifyTotePackPurchase(searchParams.session_id).catch((err) => {
      console.warn("[Dashboard] tote_purchase finalize on redirect failed:", err);
    });
  }

  const [inventory, packCatalog] = await Promise.all([
    getRealtorToteInventory(),
    listTotePackOptions(),
  ]);

  const greeting = profile?.first_name ? `Welcome, ${profile.first_name}.` : "Welcome.";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
              Realtor Portal
            </p>
            <h1 className="text-3xl font-black sm:text-4xl">{greeting}</h1>
            {profile?.realtor_brokerage && (
              <p className="mt-1 text-sm text-stone-400">{profile.realtor_brokerage}</p>
            )}
          </div>
          <Link
            href="/realtors/dashboard/settings"
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-stone-300 hover:border-slate-600 sm:px-4 sm:text-sm"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>

        {/* ── Action tiles ─────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <ActionTile
            icon={Gift}
            label="Send a Gift"
            description="Pick a tote package, address it to your buyer or seller, and send the link."
            href="/realtors/dashboard/gifts/new"
            primary
          />
          <ActionTile
            icon={Package}
            label="Your Gifts"
            description="Track delivery, pickup, and redemption status for every gift you've sent."
            href="/realtors/dashboard/gifts"
          />
        </div>

        {/* ── How it works ─────────────────────────────────────────── */}
        <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
          <h2 className="mb-6 text-lg font-bold">How the closing-gift toolkit works</h2>
          <ol className="space-y-5">
            <Step
              n={1}
              title="Pick a package"
              desc="Starter (20 totes), Standard (30), Pro (40), or Premium (50). 7-, 14-, or 28-day rentals. Pricing matches the published catalog."
            />
            <Step
              n={2}
              title="Address it to your buyer or seller"
              desc="Enter their name, email, and the property address. Add a personal note &mdash; it shows up on the gift page they see."
            />
            <Step
              n={3}
              title="Send the link"
              desc="They click, verify with a one-time code, and schedule delivery and pickup. Account creation is automatic."
            />
            <Step
              n={4}
              title="A local pro delivers and picks up"
              desc="We route fulfillment to the nearest vetted installer in our network. Every tote arrives co-branded with your name."
            />
          </ol>
        </div>

        {/* ── Analytics (real numbers from this realtor's gifts) ───── */}
        <div className="mt-12">
          <AnalyticsSection realtorId={user!.id} />
        </div>

        {/* ── Recent activity timeline ──────────────────────────────
            Self-hides when this realtor has no events yet; the Analytics
            section's empty state already covers the first-use case. */}
        <div className="mt-8">
          <RecentActivitySection realtorId={user!.id} />
        </div>

        {/* ── Tote inventory ───────────────────────────────────────────
            Replaces the prior "Realtor Pro" Coming Soon slot. Buy 27-gal
            totes in bulk, dispatch 10–50 per gift via inventory mode
            (PR4 wires the gift-side flow). */}
        <div className="mt-8">
          <ToteInventorySection
            inventory={inventory}
            packs={packCatalog.packs}
            custom={packCatalog.custom}
          />
        </div>

        {/* ── Referrals (migration 119) ────────────────────────────────
            Share link + lifetime conversion stats. Each converted
            referral waives the installer's platform fee AND credits
            this realtor 5 totes. */}
        <div className="mt-8">
          <ReferralsSection />
        </div>

        {/* ── Settings shortcut ────────────────────────────────────── */}
        <div className="mt-8">
          <SettingsLinkCard
            icon={Settings}
            title="Custom branding"
            desc="Add your photo, brokerage logo, and a signature line to every recipient page."
            href="/realtors/dashboard/settings"
          />
        </div>
      </div>
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  description,
  href,
  primary,
  comingSoon,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  href: string;
  primary?: boolean;
  comingSoon?: boolean;
}) {
  const className = primary
    ? "group relative flex flex-col gap-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6 transition-all hover:border-yellow-400/60 hover:bg-yellow-400/10"
    : "group relative flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 transition-all hover:border-slate-700";

  const body = (
    <>
      <div className="flex items-center gap-3">
        <Icon className={primary ? "h-6 w-6 text-yellow-400" : "h-6 w-6 text-stone-300"} />
        <h3 className="text-lg font-bold">{label}</h3>
        {comingSoon && (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
            Soon
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-stone-400">{description}</p>
    </>
  );

  // While the destination doesn't exist yet (A2), render as a non-clickable
  // tile rather than a dead link.
  if (comingSoon) {
    return <div className={`${className} cursor-not-allowed opacity-70`}>{body}</div>;
  }
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-slate-950">
        {n}
      </div>
      <div>
        <p className="font-bold text-white">{title}</p>
        <p className="text-sm text-stone-400">{desc}</p>
      </div>
    </li>
  );
}

function SettingsLinkCard({
  icon: Icon,
  title,
  desc,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-5 transition-all hover:border-yellow-400/60 hover:bg-yellow-400/10"
    >
      <Icon className="mb-3 h-5 w-5 text-yellow-400" />
      <p className="mb-1 text-sm font-bold text-stone-200 group-hover:text-yellow-300">{title}</p>
      <p className="text-xs leading-relaxed text-stone-400">{desc}</p>
    </Link>
  );
}
