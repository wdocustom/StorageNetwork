import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// PageHeader — the one header every installer dashboard page uses.
//
//   [←]  Title                      [actions]
//        subtitle
//
// Title case, one size. The back arrow appears only on pages that live under
// a tab (More → Schedule, Jobs → a job); the five tabs themselves have none —
// the tab bar is the navigation.
// ═══════════════════════════════════════════════════════════════════════════

export default function PageHeader({
  title,
  subtitle,
  back,
  actions,
  sticky = true,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Parent page to return to (omit on the five main tabs) */
  back?: string;
  actions?: React.ReactNode;
  /** Off when the page pins its own bar (e.g. Jobs' tab strip) instead */
  sticky?: boolean;
}) {
  return (
    <header
      className={`${sticky ? "sticky top-0 z-10" : ""} border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur`}
    >
      <div className="mx-auto flex min-h-10 max-w-3xl items-center gap-3">
        {back && (
          <Link
            href={back}
            aria-label="Back"
            className="-ml-1.5 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-white">{title}</h1>
          {subtitle && <p className="truncate text-xs text-stone-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
