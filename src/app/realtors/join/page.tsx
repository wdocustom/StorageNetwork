"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Mail,
  Lock,
  User,
  Building2,
  Award,
  Gift,
  Package,
  MapPin,
} from "lucide-react";

import { onboardRealtor } from "@/app/actions/onboard-realtor";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { stampLastLogin } from "@/app/actions/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor Onboarding — Closing-Gift Toolkit Signup
//
// Mirrors /partner/join in structure (same auth handoff, same brand palette)
// but the angle is different: realtors are credibility-driven and care about
// relationship + brand. The pitch leads with the closing-gift moment, not
// money or tooling.
// ═══════════════════════════════════════════════════════════════════════════

const VALUE_PROPS = [
  {
    icon: Gift,
    label: "THE GIFT",
    title: "Best Closing Gift on the Market",
    desc: "Reusable totes, delivered to your buyer or seller. No cardboard, no mess.",
  },
  {
    icon: Package,
    label: "WHITE GLOVE",
    title: "Local Pro Delivers & Picks Up",
    desc: "A vetted local installer handles delivery and pickup. We route the job automatically — you don't manage any hand-off.",
  },
];

export default function RealtorJoinPage() {
  return (
    <Suspense>
      <RealtorJoinPageInner />
    </Suspense>
  );
}

function RealtorJoinPageInner() {
  const [name, setName] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");

    if (!name.trim() || !brokerage.trim() || !email.trim() || !password) {
      setError("Name, brokerage, email, and password are all required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (isDisposableEmail(email)) {
      setError("Please use your real brokerage or personal email. Temporary and alias email services are not accepted.");
      return;
    }

    setLoading(true);
    const result = await onboardRealtor({
      name: name.trim(),
      brokerage: brokerage.trim(),
      licenseNumber: licenseNumber.trim() || undefined,
      email: email.trim(),
      password,
    });

    if (result.success) {
      const supabase = getSupabaseBrowserClient();
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInData?.user) {
        await stampLastLogin(signInData.user.id);
      }
      window.location.href = result.redirectUrl || "/realtors/dashboard";
    } else {
      setError(result.error || "Something went wrong.");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div className="relative flex flex-col lg:min-h-screen lg:flex-row">
        {/* Left: pitch */}
        <div className="flex flex-col justify-center px-6 py-16 lg:w-1/2 lg:px-16">
          <Link href="/" className="mb-10 flex items-center gap-3">
            <Image
              src="/landing_page_logo.png"
              alt="Storage Network"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
              priority
            />
            <span className="text-lg font-bold tracking-tight text-white">Storage Network</span>
          </Link>

          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            For Realtors
          </p>
          <h1 className="mb-5 text-4xl font-black leading-tight text-white sm:text-5xl">
            The smartest <span className="text-yellow-400">closing gift</span> you'll ever send.
          </h1>
          <p className="mb-10 max-w-xl text-base leading-relaxed text-stone-400 sm:text-lg">
            Reusable moving totes delivered to your buyer or seller before the move and picked up after they're settled. Pick a package, send a link. We handle the rest.
          </p>

          <div className="space-y-5">
            {VALUE_PROPS.map(({ icon: Icon, label, title, desc }) => (
              <div key={title} className="flex gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/30">
                  <Icon className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">{label}</p>
                  <p className="mb-1 text-base font-bold text-white">{title}</p>
                  <p className="text-sm leading-relaxed text-stone-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: signup form */}
        <div className="flex items-center justify-center bg-slate-900/30 px-6 py-16 lg:w-1/2 lg:px-16">
          <div className="w-full max-w-md">
            <h2 className="mb-2 text-2xl font-black text-white">Start sending gifts</h2>
            <p className="mb-8 text-sm text-stone-400">Free to join. You only pay when you send a package.</p>

            <div className="space-y-4">
              <Field icon={User} placeholder="Full name" value={name} onChange={setName} onKeyDown={handleKeyDown} autoComplete="name" />
              <Field icon={Building2} placeholder="Brokerage" value={brokerage} onChange={setBrokerage} onKeyDown={handleKeyDown} autoComplete="organization" />
              <Field icon={Award} placeholder="License # (optional)" value={licenseNumber} onChange={setLicenseNumber} onKeyDown={handleKeyDown} />
              <Field icon={Mail} placeholder="Work email" value={email} onChange={setEmail} onKeyDown={handleKeyDown} type="email" autoComplete="email" />
              <Field icon={Lock} placeholder="Password (min 6)" value={password} onChange={setPassword} onKeyDown={handleKeyDown} type="password" autoComplete="new-password" />
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-3.5 text-base font-bold text-slate-950 transition-all hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>Create Realtor Account</>
              )}
            </button>

            <p className="mt-4 text-center text-xs text-stone-500">
              Already have an account?{" "}
              <Link href="/realtors/login" className="font-semibold text-yellow-400 hover:underline">
                Sign in
              </Link>
            </p>

            <div className="mt-8 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-stone-500">
              <MapPin className="h-4 w-4 shrink-0 text-yellow-400" />
              <span>
                Fulfillment is handled by our local installer network. We&apos;ll confirm coverage in your buyer&apos;s area before each gift is finalized.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  type?: string;
  autoComplete?: string;
}

function Field({ icon: Icon, placeholder, value, onChange, onKeyDown, type = "text", autoComplete }: FieldProps) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-4 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />
    </div>
  );
}
