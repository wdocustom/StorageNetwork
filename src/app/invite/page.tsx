"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";

const InstallerChatWidget = dynamic(() => import("@/components/chat/InstallerChatWidget"), { ssr: false });
import {
  ChevronRight,
  Loader2,
  DollarSign,
  ClipboardList,
  Zap,
  MapPin,
  User,
  Mail,
  Lock,
  Building2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Package,
  Rows3,
  Warehouse,
  Sprout,
} from "lucide-react";
import { onboardInstaller } from "@/app/actions/onboard-installer";
import { checkTerritoryAvailability } from "@/app/actions/territory";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { stampLastLogin } from "@/app/actions/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import InstallerTestimonials from "@/components/landing/InstallerTestimonials";

const HERO_BULLETS = [
  { icon: DollarSign, text: "Pre-sold customers. Deposits already collected." },
  { icon: ClipboardList, text: "Cut lists included. Zero math. Just build." },
  { icon: Zap, text: 'Tap "Complete." Money hits your bank via Stripe.' },
];

const PRODUCT_LINES = [
  { icon: Package, name: "Tote Racks", status: "LIVE" },
  { icon: Rows3, name: "Open Shelving", status: "LIVE" },
  { icon: Warehouse, name: "Overhead Storage", status: "LIVE" },
  { icon: Sprout, name: "Raised Beds", status: "LIVE" },
];

const OBJECTIONS = [
  { q: "What does it cost?", a: "Free to start. First 3 jobs, zero fees." },
  { q: "Do I need special tools?", a: "Miter saw, drill, tape measure. That's it." },
  { q: "Can I keep my other work?", a: "Yes. Most installers do this on weekends." },
];

export default function InvitePage() {
  return (
    <Suspense>
      <InvitePageContent />
    </Suspense>
  );
}

function InvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [territoryStatus, setTerritoryStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [territoryMessage, setTerritoryMessage] = useState("");
  const territoryCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      document.cookie = `sn_ref=${ref};max-age=${30 * 24 * 60 * 60};path=/;samesite=lax`;
    }
  }, [searchParams]);

  const checkTerritory = useCallback(async (zip: string) => {
    if (zip.length !== 5) {
      setTerritoryStatus("idle");
      setTerritoryMessage("");
      return;
    }

    setTerritoryStatus("checking");
    setTerritoryMessage("");

    try {
      const result = await checkTerritoryAvailability(zip);
      if (result.available) {
        setTerritoryStatus("available");
        const preview = result.clusterPreview;
        setTerritoryMessage(
          preview
            ? `Territory available! You'll cover ~${preview.estimatedZips} ZIP codes.`
            : "Territory available!"
        );
      } else {
        setTerritoryStatus("taken");
        setTerritoryMessage(
          result.reason || "Territory unavailable. Try a different ZIP code."
        );
      }
    } catch {
      setTerritoryStatus("idle");
    }
  }, []);

  async function handleSubmit() {
    setError("");

    if (!name.trim() || !email.trim() || !password.trim() || !zipCode.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (isDisposableEmail(email)) {
      setError("Please use a real business or personal email. Temporary and alias email services are not accepted.");
      return;
    }

    setLoading(true);

    try {
      const result = await onboardInstaller({
        name: name.trim(),
        businessName: businessName.trim() || name.trim(),
        email: email.trim().toLowerCase(),
        password,
        zipCode: zipCode.trim(),
        withStandardTrial: true,
      });

      if (!result.success) {
        setError(result.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        setError("Account created! Please log in at /login");
        setLoading(false);
        return;
      }

      if (signInData?.user) {
        await stampLastLogin(signInData.user.id);
      }
      window.location.href = result.redirectUrl || "/dashboard";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function scrollToSignup() {
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ══════════════════════════════════════════════════════════════════
          HERO — Money Headline (left) + Signup Form (right)
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden px-4 py-16 pt-20 sm:pt-24">
        {/* Radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 20%, rgba(250,204,21,0.12) 0%, transparent 60%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-5xl">
          {/* Badge */}
          <div className="mb-8 flex justify-center lg:justify-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/5 px-4 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
                Territories Open In Your Area
              </span>
            </div>
          </div>

          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left — Headline + Bullets */}
            <div className="text-center lg:text-left">
              <Image
                src="/landing_page_logo.png"
                alt="Storage Network"
                width={140}
                height={140}
                priority
                className="mx-auto mb-6 h-20 w-auto object-contain sm:h-24 lg:mx-0"
              />

              <h1 className="mb-6 text-4xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Make{" "}
                <span className="text-yellow-400">$800–$1,200</span>
                <br />
                Per Weekend.
              </h1>

              <div className="mb-6 space-y-3">
                {HERO_BULLETS.map((b) => (
                  <div key={b.text} className="flex items-center gap-3 text-left lg:items-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10">
                      <b.icon className="h-4 w-4 text-yellow-400" />
                    </div>
                    <p className="text-sm font-medium text-stone-300 sm:text-base">{b.text}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs font-semibold text-stone-600">
                3 Jobs Free — No Credit Card Required
              </p>
            </div>

            {/* Right — Signup Form */}
            <div id="signup" className="mx-auto w-full max-w-md lg:mx-0">
              <div className="rounded-2xl border border-stone-800 bg-gray-900 p-6 sm:p-8">
                <h2 className="mb-1 text-center text-xl font-black uppercase text-white sm:text-2xl">
                  Claim Your <span className="text-yellow-400">Territory</span>
                </h2>
                <p className="mb-6 text-center text-xs text-stone-500">
                  3 jobs free. No credit card required.
                </p>

                <div className="space-y-3.5">
                  <FormField
                    icon={User}
                    label="Your Name"
                    type="text"
                    value={name}
                    onChange={setName}
                    placeholder="John Smith"
                  />
                  <FormField
                    icon={Building2}
                    label="Business Name"
                    labelSuffix="(optional)"
                    type="text"
                    value={businessName}
                    onChange={setBusinessName}
                    placeholder="Smith's Handyman Services"
                  />
                  <FormField
                    icon={Mail}
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="john@example.com"
                  />
                  <FormField
                    icon={Lock}
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="6+ characters"
                  />

                  {/* ZIP — with territory check */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Your ZIP Code
                    </label>
                    <div
                      className={`flex items-center rounded-lg border bg-gray-800 transition-colors ${
                        territoryStatus === "available"
                          ? "border-emerald-500"
                          : territoryStatus === "taken"
                            ? "border-red-500"
                            : "border-stone-700 focus-within:border-yellow-400"
                      }`}
                    >
                      <MapPin
                        className={`ml-3 h-4 w-4 shrink-0 ${
                          territoryStatus === "available"
                            ? "text-emerald-400"
                            : territoryStatus === "taken"
                              ? "text-red-400"
                              : "text-stone-500"
                        }`}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={zipCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                          setZipCode(val);
                          if (territoryCheckTimer.current) clearTimeout(territoryCheckTimer.current);
                          if (val.length === 5) {
                            territoryCheckTimer.current = setTimeout(() => checkTerritory(val), 400);
                          } else {
                            setTerritoryStatus("idle");
                            setTerritoryMessage("");
                          }
                        }}
                        placeholder="90210"
                        className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-600 outline-none"
                      />
                      {territoryStatus === "checking" && (
                        <Loader2 className="mr-3 h-4 w-4 shrink-0 animate-spin text-yellow-400" />
                      )}
                      {territoryStatus === "available" && (
                        <CheckCircle2 className="mr-3 h-4 w-4 shrink-0 text-emerald-400" />
                      )}
                      {territoryStatus === "taken" && (
                        <XCircle className="mr-3 h-4 w-4 shrink-0 text-red-400" />
                      )}
                    </div>
                    {territoryMessage && (
                      <p
                        className={`mt-1.5 text-xs font-medium ${
                          territoryStatus === "available" ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {territoryMessage}
                      </p>
                    )}
                  </div>

                  {error && <p className="text-xs font-medium text-red-400">{error}</p>}

                  <button
                    onClick={handleSubmit}
                    disabled={loading || territoryStatus === "taken" || territoryStatus === "checking"}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Start Getting Jobs
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-stone-600">
                    No credit card. Cancel anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          PLATFORM EVOLUTION — Not Just Tote Racks
      ══════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-800/50 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-stone-600">
            A Growing Platform
          </p>
          <h2 className="mb-2 text-center text-2xl font-black uppercase text-white sm:text-3xl">
            Tote Racks Today.{" "}
            <span className="text-yellow-400">More Revenue Tomorrow.</span>
          </h2>
          <p className="mx-auto mb-10 max-w-md text-center text-sm text-stone-500">
            New product lines roll out regularly. Your business grows with the platform.
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {PRODUCT_LINES.map((p) => (
              <div
                key={p.name}
                className="flex flex-col items-center gap-3 rounded-xl border border-stone-800 bg-gray-900 p-6 text-center transition-colors hover:border-yellow-400/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/10">
                  <p.icon className="h-6 w-6 text-yellow-400" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-white">{p.name}</p>
                <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                  {p.status}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <a
              href="/features"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 transition-colors hover:text-yellow-400"
            >
              See all platform features
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════════════ */}
      <InstallerTestimonials />

      {/* ══════════════════════════════════════════════════════════════════
          OBJECTION BUSTERS + CTA
      ══════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-800/50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-black uppercase text-white sm:text-3xl">
            Still Thinking It Over?
          </h2>

          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {OBJECTIONS.map((o) => (
              <div key={o.q} className="rounded-xl border border-stone-800 bg-gray-900 p-5 text-center">
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">{o.q}</p>
                <p className="text-sm font-semibold text-white">{o.a}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={scrollToSignup}
              className="group inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
            >
              Claim Your Territory
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <p className="mt-3 text-[11px] text-stone-600">
              3 jobs free. No credit card.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-800 bg-gray-950 px-4 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/Header_avatar_logo.png"
              alt="Storage Network"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
            />
          </div>
          <p className="text-xs text-stone-700">
            &copy; {new Date().getFullYear()} Storage-Network.app
          </p>
          <div className="flex items-center gap-4">
            <a href="/legal/privacy" className="text-[11px] text-stone-600 hover:text-stone-400">
              Privacy
            </a>
            <a href="/legal/terms" className="text-[11px] text-stone-600 hover:text-stone-400">
              Terms
            </a>
            <a href="/login" className="text-[11px] text-stone-600 hover:text-yellow-400">
              Partner Login
            </a>
          </div>
        </div>
      </footer>

      <InstallerChatWidget />
    </div>
  );
}

function FormField({
  icon: Icon,
  label,
  labelSuffix,
  type,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  labelSuffix?: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-stone-500">
        {label}{" "}
        {labelSuffix && <span className="font-normal text-stone-600">{labelSuffix}</span>}
      </label>
      <div className="flex items-center rounded-lg border border-stone-700 bg-gray-800 focus-within:border-yellow-400">
        <Icon className="ml-3 h-4 w-4 shrink-0 text-stone-500" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-600 outline-none"
        />
      </div>
    </div>
  );
}
