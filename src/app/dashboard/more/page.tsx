import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BarChart3, BookOpen, Building2, CalendarOff, ChevronRight, DollarSign, Gift, Package, Settings, Share2, Users, Zap, type LucideIcon } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import SignOutButton from "@/components/dashboard/SignOutButton";
import PageHeader from "@/components/dashboard/PageHeader";

// ═══════════════════════════════════════════════════════════════════════════
// More — every dashboard tool that isn't one of the four main tabs.
// ═══════════════════════════════════════════════════════════════════════════

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  dot?: boolean;
}

const ROW = "flex w-full items-center gap-3 px-4 py-3.5 transition hover:bg-slate-800/60 active:bg-slate-800";

export default async function MorePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const db = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: profile }, { count: recentPosts }] = await Promise.all([
    db.from("profiles").select("is_pro, is_admin, is_realtor").eq("id", user.id).single(),
    db.from("posts").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Business",
      items: [
        { href: "/dashboard/sales", label: "Sales & payouts", icon: DollarSign },
        { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/dashboard/schedule", label: "Schedule", icon: CalendarOff },
        { href: "/dashboard/inventory", label: "Inventory", icon: Package },
        { href: "/dashboard/tote-rentals", label: "Tote rentals", icon: Gift },
      ],
    },
    {
      title: "Grow",
      items: [
        { href: "/community", label: "Community", icon: Users, dot: (recentPosts ?? 0) > 0 },
        { href: "/dashboard/guides", label: "Guides & plans", icon: BookOpen },
        { href: "/dashboard/referrals", label: "Referrals", icon: Share2 },
      ],
    },
    {
      title: "Account",
      items: [
        { href: "/dashboard/profile", label: "Settings", icon: Settings },
        ...(profile && !profile.is_pro ? [{ href: "/upgrade", label: "Go Pro", icon: Zap }] : []),
        ...(profile?.is_realtor ? [{ href: "/realtors/dashboard", label: "Realtor portal", icon: Building2 }] : []),
      ],
    },
    ...(profile?.is_admin
      ? [{ title: "Admin", items: [{ href: "/dashboard/platform-analytics", label: "Platform analytics", icon: Activity }] }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader title="More" />
      <main className="px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">{g.title}</h2>
              <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                {g.items.map(({ href, label, icon: Icon, dot }) => (
                  <li key={href}>
                    <Link href={href} className={ROW}>
                      <span className="relative">
                        <Icon className="h-5 w-5 text-stone-400" />
                        {dot && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-white">{label}</span>
                      <ChevronRight className="h-4 w-4 text-stone-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <SignOutButton className={ROW} />
          </div>
        </div>
      </main>
    </div>
  );
}
