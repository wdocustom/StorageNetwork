"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard shell — the installer's persistent navigation:
//
//   Today · Jobs · Quote · Marketing · More
//
// A bottom tab bar on phones, a sidebar on desktop. Every tab is a <Link>,
// so switching never reloads the app. The affiliate / promoter portals live
// under /dashboard too but aren't installer workspaces, so they get no shell.
// ═══════════════════════════════════════════════════════════════════════════

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, HardHat, House, LayoutGrid, Megaphone } from "lucide-react";
import { siteConfig } from "@/config/site";

const TABS = [
  { href: "/dashboard", label: "Today", icon: House, match: (p: string) => p === "/dashboard" },
  {
    href: "/dashboard/leads",
    label: "Jobs",
    icon: Briefcase,
    match: (p: string) => p.startsWith("/dashboard/leads") || p.startsWith("/dashboard/sales"),
  },
  { href: "/dashboard/build", label: "Quote", icon: HardHat, match: (p: string) => p.startsWith("/dashboard/build") },
  {
    href: "/dashboard/marketing",
    label: "Marketing",
    icon: Megaphone,
    match: (p: string) => p.startsWith("/dashboard/marketing"),
  },
] as const;

const NO_SHELL = ["/dashboard/affiliate", "/dashboard/promoter"];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (NO_SHELL.some((p) => pathname.startsWith(p))) return <>{children}</>;

  const activeTab = TABS.find((t) => t.match(pathname));
  const tabs = [
    ...TABS.map((t) => ({ ...t, active: t === activeTab })),
    { href: "/dashboard/more", label: "More", icon: LayoutGrid, active: !activeTab },
  ];

  return (
    <div className="min-h-screen bg-slate-950 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-56">
      {children}

      {/* ── Desktop sidebar ── */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-slate-800 bg-slate-900 lg:flex"
      >
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
          <Image src={siteConfig.logoPath} alt={siteConfig.name} width={160} height={64} className="h-12 w-auto object-contain" />
        </Link>
        <ul className="space-y-1 px-3">
          {tabs.map(({ href, label, icon: Icon, active }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "bg-yellow-400/10 text-yellow-400" : "text-stone-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Phone tab bar ── */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {tabs.map(({ href, label, icon: Icon, active }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  active ? "text-yellow-400" : "text-stone-500 active:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
