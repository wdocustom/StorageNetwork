"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin, Loader2, ChevronRight, CheckCircle2, Star,
  ArrowRight,
} from "lucide-react";
import { checkAvailability, type AvailabilityResult } from "@/app/actions/customer";

type Step = "zip" | "installer-reveal";

export default function InlineConfigurator() {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("zip");
  const [installer, setInstaller] = useState<AvailabilityResult | null>(null);

  async function handleSearch() {
    const trimmed = zip.trim();
    if (trimmed.length < 5) { setError("Enter a valid 5-digit ZIP code."); return; }
    setError(""); setSearching(true);
    try {
      const result = await checkAvailability(trimmed);
      if (result.available && result.installer_id) {
        setInstaller(result); setStep("installer-reveal");
      } else { setError(result.message || "No installer found in this area yet."); }
    } catch { setError("Unable to check availability. Please try again."); }
    finally { setSearching(false); }
  }

  function goToDesign() {
    if (!installer?.installer_id) return;
    router.push(`/design?installer=${installer.installer_id}&from=network`);
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* ── ZIP ──────────────────────────────────────────────── */}
      {step === "zip" && (
        <div className="animate-fadeInUp">
          <div className="flex overflow-hidden rounded-xl border-2 border-yellow-400/30 bg-gray-900 shadow-2xl shadow-yellow-400/10 transition-all focus-within:border-yellow-400">
            <div className="flex items-center pl-4 text-yellow-400"><MapPin className="h-5 w-5" /></div>
            <input type="text" inputMode="numeric" maxLength={5} value={zip}
              aria-label="ZIP code"
              onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Enter your ZIP code"
              className="w-full bg-transparent px-3 py-4 text-lg font-medium text-white placeholder-stone-500 outline-none" autoFocus />
            <button onClick={handleSearch} disabled={searching || zip.length < 5}
              className="m-1.5 flex shrink-0 items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-yellow-300 disabled:opacity-50">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Find</span><ChevronRight className="h-4 w-4" /></>}
            </button>
          </div>
          {error && <p className="mt-3 text-sm font-medium text-red-400">{error}</p>}
          <p className="mt-4 text-xs text-stone-600">Enter your ZIP to find your local certified installer and start designing.</p>
        </div>
      )}

      {/* ── Installer Reveal → Go to 3D Designer ─────────────── */}
      {step === "installer-reveal" && installer && (
        <div className="animate-fadeInUp rounded-2xl border border-stone-700/50 bg-gray-900/60 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-400 bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-400/30">
            {installer.installer_avatar_url ? (
              <Image src={installer.installer_avatar_url} alt={installer.installer_name || ""} width={80} height={80} className="h-full w-full object-cover" unoptimized />
            ) : (
              <Image src="/Header_avatar_logo.png" alt="Storage Network" width={80} height={80} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Verified Pro
          </div>
          <h3 className="mb-1 text-2xl font-black uppercase text-white">{installer.installer_name}</h3>
          <div className="mb-4 flex items-center justify-center gap-0.5">
            {[1,2,3,4,5].map((i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
          </div>
          <p className="mb-6 text-sm text-stone-400">Your certified pro is ready. Design your system in 3D with instant pricing.</p>
          <button onClick={goToDesign}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5">
            Design Your System <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
