// Force dynamic rendering — community pages require auth + live data
export const dynamic = "force-dynamic";

import Image from "next/image";
import { siteConfig } from "@/config/site";

export const metadata = {
  title: "Pro Community | Storage Network",
  description:
    "Exclusive community for Storage Network Pro installers. Share builds, get advice, and grow your business.",
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* ── Community Header ──────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="flex items-center gap-3">
              <Image
                src={siteConfig.logoPath}
                alt={siteConfig.name}
                width={40}
                height={40}
                className="h-10 w-auto flex-shrink-0 object-contain"
              />
            </a>
            <div className="flex items-center gap-2">
              <a
                href="/community"
                className="text-sm font-bold uppercase tracking-wider text-white hover:text-yellow-400 transition-colors"
              >
                Pro Community
              </a>
              <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-yellow-400">
                PRO
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/community/new"
              className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-gray-950 transition-colors hover:bg-yellow-300"
            >
              New Post
            </a>
            <a
              href="/dashboard"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-slate-800 px-4 py-3 text-center text-[10px] text-stone-700">
        {siteConfig.name} Pro Community &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
