import Image from "next/image";
import { siteConfig } from "@/config/site";

/** Centered card layout for the partner login / set-password pages. */
export default function PartnerShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-950 px-4 py-12">
      <Image src={siteConfig.logoPath} alt={siteConfig.name} width={160} height={64} className="mb-8 h-12 w-auto object-contain" priority />
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Partner dashboard</p>
        <h1 className="mt-1 text-xl font-black text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-stone-400">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
