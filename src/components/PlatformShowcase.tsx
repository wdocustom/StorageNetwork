import { Zap, CreditCard, Box } from "lucide-react";
import PhoneMockup from "@/components/PhoneMockup";

// ═══════════════════════════════════════════════════════════════════════════
// Platform Showcase — Premium SaaS-style section with phone mockups
// ═══════════════════════════════════════════════════════════════════════════

const FEATURES = [
  {
    icon: Zap,
    title: "Instant Quoting",
    desc: "Customers design their system in 30 seconds with our 3D tool. You get a job, not a tire-kicker.",
  },
  {
    icon: CreditCard,
    title: "Stripe Payments",
    desc: "Deposits collected before you lift a finger. Job completion triggers instant payout to your bank.",
  },
  {
    icon: Box,
    title: "3D Visualizer",
    desc: "Your customers see exactly what they're buying. No miscommunication. No scope creep. No surprises.",
  },
];

export default function PlatformShowcase() {
  return (
    <section className="relative overflow-hidden bg-slate-950 px-6 py-20 lg:py-28">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
        <div className="h-[500px] w-[800px] rounded-full bg-yellow-400/[0.03] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-16 lg:flex-row lg:items-center lg:gap-20">
          {/* ── Left: Copy ──────────────────────────────────────────── */}
          <div className="text-center lg:w-1/2 lg:text-left">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
              The Platform
            </p>
            <h2 className="mb-4 text-3xl font-black leading-[1.1] tracking-tight text-white xl:text-4xl">
              Give your customers a premium buying experience.{" "}
              <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                Run your business from anywhere.
              </span>
            </h2>
            <p className="mb-10 max-w-md text-base leading-relaxed text-stone-400 lg:mx-0 mx-auto">
              Everything you need to close jobs, manage installs, and get paid — all from your phone.
            </p>

            <div className="space-y-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="flex gap-4 text-left lg:mx-0 mx-auto max-w-md"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                    <f.icon className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{f.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-stone-500">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Stacked phone mockups ────────────────────────── */}
          <div className="relative lg:w-1/2">
            {/* Mobile: stacked vertically */}
            <div className="flex flex-col items-center gap-8 lg:hidden">
              <PhoneMockup
                src="/images/dashboard-preview.png"
                alt="Installer Pro Dashboard showing earnings, job routing, and business management tools"
                priority
                className="w-56"
              />
              <PhoneMockup
                src="/images/designer-preview.png"
                alt="Customer 3D Design Tool showing the tote storage system configurator"
                className="w-56"
              />
            </div>

            {/* Desktop: overlapping staggered layout */}
            <div className="hidden lg:block">
              <div className="relative mx-auto" style={{ height: 520 }}>
                {/* Dashboard phone — front left */}
                <div className="absolute left-0 top-0 z-20">
                  <PhoneMockup
                    src="/images/dashboard-preview.png"
                    alt="Installer Pro Dashboard showing earnings, job routing, and business management tools"
                    priority
                    className="w-52 xl:w-60"
                  />
                </div>

                {/* Designer phone — behind right, shifted down */}
                <div className="absolute left-32 top-12 z-10 xl:left-36">
                  <PhoneMockup
                    src="/images/designer-preview.png"
                    alt="Customer 3D Design Tool showing the tote storage system configurator"
                    className="w-52 xl:w-60"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
