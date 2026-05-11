"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  Coins,
  Loader2,
  Wand2,
  Wrench,
  Building2,
  Sun,
  Factory,
  House,
  Boxes,
  AlertTriangle,
  Download,
  RefreshCw,
  ChevronDown,
  Sliders,
  Square,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import {
  generateMarketingAsset,
  getMarketingCredits,
  type Scene,
  type Vibe,
  type AspectRatio,
  type BrandColor,
} from "@/app/actions/generate-marketing-asset";

interface SceneOption {
  id: Scene;
  label: string;
  hint: string;
  Icon: typeof Wrench;
}

interface VibeOption {
  id: Vibe;
  label: string;
  hint: string;
  Icon: typeof Sun;
}

const SCENE_OPTIONS: SceneOption[] = [
  { id: "disaster_garage", label: "Disaster Garage", hint: "Pain-state \"before\" shot", Icon: AlertTriangle },
  { id: "luxury_garage", label: "Pristine Luxury Garage", hint: "Aspirational \"after\" shot", Icon: Building2 },
  { id: "tool_closeup", label: "Close-up Tool Organization", hint: "Hero detail / craftsmanship", Icon: Boxes },
];

const VIBE_OPTIONS: VibeOption[] = [
  { id: "bright_airy", label: "Bright & Airy", hint: "Soft daylight, white walls", Icon: Sun },
  { id: "industrial_dark", label: "Industrial Dark", hint: "Moody, high contrast", Icon: Factory },
  { id: "suburban_clean", label: "Suburban Clean", hint: "Familiar, mid-day, friendly", Icon: House },
];

const ASPECT_OPTIONS: { id: AspectRatio; label: string; hint: string; Icon: typeof Square }[] = [
  { id: "landscape", label: "Landscape", hint: "16:9 · FB, web hero", Icon: RectangleHorizontal },
  { id: "square", label: "Square", hint: "1:1 · IG feed", Icon: Square },
  { id: "portrait", label: "Portrait", hint: "9:16 · Stories, Reels", Icon: RectangleVertical },
];

const BRAND_COLOR_OPTIONS: { id: BrandColor; label: string; swatch: string }[] = [
  { id: "black_yellow", label: "Black + Yellow", swatch: "linear-gradient(135deg,#0f172a 50%,#facc15 50%)" },
  { id: "white_blue", label: "White + Blue", swatch: "linear-gradient(135deg,#f8fafc 50%,#2563eb 50%)" },
  { id: "natural_cedar", label: "Natural Cedar", swatch: "linear-gradient(135deg,#c8915a,#8b5a2b)" },
  { id: "industrial_gray", label: "Industrial Gray", swatch: "linear-gradient(135deg,#475569,#1e293b)" },
];

const CUSTOM_DETAIL_MAX = 400;

const PREVIEW_ASPECT_CLASS: Record<AspectRatio, string> = {
  landscape: "aspect-[16/9]",
  square: "aspect-square",
  portrait: "aspect-[9/16] mx-auto max-w-[60%]",
};

// Storage / organization themed flavor text — cycled while a render is in
// flight so the spinner has personality across a 10–20s FLUX call.
const LOADING_SAYINGS = [
  "Hang tight — good things take time.",
  "Stacking pixels like totes on a rack...",
  "Mounting your asset to the wall...",
  "Sweeping the studio floor before the shoot...",
  "Color-coding the highlights...",
  "Sorting by size, then by vibe...",
  "Decluttering the composition...",
  "Labeling every bin in the frame...",
  "Folding the light just right...",
  "Polishing the chrome before the close-up...",
  "Wheeling the workbench into position...",
  "Mind your overhead — stacking from the top...",
  "Measuring twice. Rendering once.",
  "Boxing up the chaos...",
  "Tidying the shadows...",
];

// Flip to `false` once the WDO Custom LoRA is trained and wired into the
// server action. While true, the UI is shown behind a "Training in progress"
// overlay and clicks are blocked so installers can't burn credits on the
// pre-trained generic FLUX model.
const COMING_SOON = true;

export default function AssetForge() {
  const [credits, setCredits] = useState<number | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("landscape");
  const [brandColor, setBrandColor] = useState<BrandColor | null>(null);
  const [customDetail, setCustomDetail] = useState("");
  const [showCustomize, setShowCustomize] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultAspect, setResultAspect] = useState<AspectRatio>("landscape");
  const [error, setError] = useState<string | null>(null);
  const [sayingIdx, setSayingIdx] = useState(0);

  useEffect(() => {
    getMarketingCredits()
      .then((r) => setCredits(r.credits))
      .catch((err) => {
        // If the action throws, fall back to 0 so the UI never gets stuck
        // on the "—" loading dash. The real error is logged for diagnosis.
        console.error("[AssetForge] Failed to load credit balance:", err);
        setCredits(0);
      });
  }, []);

  // Rotate the loading saying every 2.8s while a generation is in flight.
  // Picks a fresh random index each tick so successive sayings don't repeat.
  useEffect(() => {
    if (!generating) return;
    setSayingIdx(Math.floor(Math.random() * LOADING_SAYINGS.length));
    const id = setInterval(() => {
      setSayingIdx((prev) => {
        let next = Math.floor(Math.random() * LOADING_SAYINGS.length);
        if (next === prev) next = (next + 1) % LOADING_SAYINGS.length;
        return next;
      });
    }, 2800);
    return () => clearInterval(id);
  }, [generating]);

  const ready = scene !== null && vibe !== null && (credits ?? 0) > 0 && !generating;

  async function handleGenerate() {
    if (!scene || !vibe) return;
    setGenerating(true);
    setError(null);
    setResultUrl(null);
    setResultAspect(aspectRatio); // freeze the ratio at submit-time
    const res = await generateMarketingAsset({
      scene,
      vibe,
      aspectRatio,
      brandColor,
      customDetail: customDetail.trim() || undefined,
    });
    if (res.success) {
      setResultUrl(res.imageUrl);
      setCredits(res.creditsRemaining);
    } else {
      setError(res.error);
      if (typeof res.creditsRemaining === "number") setCredits(res.creditsRemaining);
    }
    setGenerating(false);
  }

  function handleReset() {
    setResultUrl(null);
    setError(null);
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-yellow-400/20 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {COMING_SOON && <ComingSoonOverlay />}
      <div className={COMING_SOON ? "pointer-events-none select-none blur-[1px]" : ""}>
      {/* ── Forge Header ──────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-yellow-400/10 p-1.5">
            <Sparkles className="h-4 w-4 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">AI Asset Forge</h2>
            <p className="text-[11px] text-stone-500">Generate scroll-stopping ad imagery</p>
          </div>
        </div>
        <CreditBadge credits={credits} />
      </header>

      {/* ── How credits work ──────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-5 py-2.5">
        <p className="text-[11px] leading-relaxed text-stone-400">
          <span className="font-bold text-yellow-300">+10 credits</span> are added automatically every time you complete a job. New installers start with{" "}
          <span className="font-bold text-yellow-300">10 credits</span>. Each generated asset costs 1 credit.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {/* ── Step 1: Scene ─────────────────────────────────── */}
        <StepCard step={1} title="Select the Scene" hint="What story does the image tell?">
          <div className="grid gap-2 sm:grid-cols-3">
            {SCENE_OPTIONS.map((opt) => (
              <ToggleTile
                key={opt.id}
                active={scene === opt.id}
                onClick={() => setScene(opt.id)}
                Icon={opt.Icon}
                label={opt.label}
                hint={opt.hint}
              />
            ))}
          </div>
        </StepCard>

        {/* ── Step 2: Vibe ──────────────────────────────────── */}
        <StepCard step={2} title="Set the Vibe" hint="Lighting, mood, and color treatment.">
          <div className="grid gap-2 sm:grid-cols-3">
            {VIBE_OPTIONS.map((opt) => (
              <ToggleTile
                key={opt.id}
                active={vibe === opt.id}
                onClick={() => setVibe(opt.id)}
                Icon={opt.Icon}
                label={opt.label}
                hint={opt.hint}
              />
            ))}
          </div>
        </StepCard>

        {/* ── Customize (collapsible) ───────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40">
          <button
            type="button"
            onClick={() => setShowCustomize((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-900/70"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-stone-400">
                <Sliders className="h-3 w-3" />
              </span>
              <div>
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-white">Customize</h3>
                <p className="text-[11px] text-stone-500">
                  Optional · aspect ratio, brand color, custom detail
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-stone-500 transition-transform ${showCustomize ? "rotate-180" : ""}`}
            />
          </button>

          {showCustomize && (
            <div className="space-y-5 border-t border-slate-800 px-4 py-4">
              {/* Aspect ratio */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                  Aspect Ratio
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ASPECT_OPTIONS.map((opt) => (
                    <ToggleTile
                      key={opt.id}
                      active={aspectRatio === opt.id}
                      onClick={() => setAspectRatio(opt.id)}
                      Icon={opt.Icon}
                      label={opt.label}
                      hint={opt.hint}
                    />
                  ))}
                </div>
              </div>

              {/* Brand color */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                  Brand Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {BRAND_COLOR_OPTIONS.map((opt) => {
                    const active = brandColor === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBrandColor(active ? null : opt.id)}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                          active
                            ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                            : "border-slate-700 bg-slate-800/60 text-stone-300 hover:border-slate-600"
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-slate-600"
                          style={{ background: opt.swatch }}
                        />
                        {opt.label}
                      </button>
                    );
                  })}
                  {brandColor && (
                    <button
                      type="button"
                      onClick={() => setBrandColor(null)}
                      className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[11px] font-semibold text-stone-500 hover:text-stone-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Custom detail */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="forge-custom-detail" className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                    Custom Detail
                  </label>
                  <span className="text-[10px] tabular-nums text-stone-600">
                    {customDetail.length}/{CUSTOM_DETAIL_MAX}
                  </span>
                </div>
                <textarea
                  id="forge-custom-detail"
                  value={customDetail}
                  onChange={(e) => setCustomDetail(e.target.value.slice(0, CUSTOM_DETAIL_MAX))}
                  rows={3}
                  placeholder='e.g. "winter, snow visible through the open garage door" · "with my company logo on the back wall" · "bright red sports car parked inside"'
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 outline-none focus:border-yellow-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Step 3: Generate ──────────────────────────────── */}
        <StepCard step={3} title="Generate" hint="One credit per asset. Renders in ~10–20 seconds.">
          <button
            onClick={handleGenerate}
            disabled={!ready}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-6 py-4 text-sm font-extrabold uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-500/20 transition-all hover:shadow-yellow-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Forging asset…
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5" />
                Generate Ad Asset (Costs 1 Credit)
              </>
            )}
          </button>

          {credits !== null && credits === 0 && !generating && (
            <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-wider text-rose-400">
              Out of credits
            </p>
          )}
          {error && !generating && (
            <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-wider text-rose-400">
              {error}
            </p>
          )}
        </StepCard>

        {/* ── Result Preview ────────────────────────────────── */}
        {(resultUrl || generating) && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Preview</p>
              {resultUrl && (
                <div className="flex items-center gap-2">
                  <a
                    href={resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    <Download className="h-3 w-3" /> Download
                  </a>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    <RefreshCw className="h-3 w-3" /> Reset
                  </button>
                </div>
              )}
            </div>
            <div className={`relative w-full overflow-hidden rounded-lg bg-slate-900 ${PREVIEW_ASPECT_CLASS[resultAspect]}`}>
              {generating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/80 px-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
                  <p
                    key={sayingIdx}
                    className="max-w-xs animate-fadeInUp text-sm font-medium text-stone-300"
                  >
                    {LOADING_SAYINGS[sayingIdx]}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                    Rendering · ~10–20s
                  </p>
                </div>
              )}
              {resultUrl && !generating && (
                <Image
                  src={resultUrl}
                  alt="Generated marketing asset"
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                />
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function ComingSoonOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm">
      {/* animated gradient halo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />

      <div className="relative mx-6 max-w-md overflow-hidden rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-7 shadow-2xl shadow-yellow-500/10">
        {/* shimmer sweep */}
        <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent" />

        {/* top eyebrow with pulsing dot */}
        <div className="mb-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-400" />
          </span>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-yellow-400">
            Training in Progress
          </p>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-400" />
          <h3 className="text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
            Custom AI for Your Builds
          </h3>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-stone-300">
          We&apos;re fine-tuning the model on{" "}
          <span className="font-bold text-yellow-300">real Storage-Network installs</span> so every
          generated asset matches your signature racks, totes, and finishes —{" "}
          <span className="font-bold text-white">not generic stock photos</span>.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-300">Live</p>
            <p className="text-sm font-extrabold text-white">Tomorrow</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Powered by</p>
            <p className="text-[11px] font-bold text-stone-300">FLUX · Custom LoRA</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreditBadge({ credits }: { credits: number | null }) {
  const display = credits ?? "—";
  const low = credits !== null && credits <= 2;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
        low
          ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
          : "border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
      }`}
    >
      <Coins className="h-3.5 w-3.5" />
      {display} {credits === 1 ? "Credit" : "Credits"} Available
    </div>
  );
}

function StepCard({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400/15 text-[11px] font-extrabold text-yellow-400">
          {step}
        </span>
        <div className="flex-1">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-white">{title}</h3>
          <p className="text-[11px] text-stone-500">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleTile({
  active,
  onClick,
  Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Sun;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all active:scale-[0.99] ${
        active
          ? "border-yellow-400 bg-yellow-400/10 shadow-md shadow-yellow-500/10"
          : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/60"
      }`}
    >
      <div
        className={`rounded-md p-1.5 transition-colors ${
          active ? "bg-yellow-400/20 text-yellow-400" : "bg-slate-800 text-stone-400 group-hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span
        className={`text-[12px] font-bold uppercase tracking-wider ${
          active ? "text-white" : "text-stone-300"
        }`}
      >
        {label}
      </span>
      <span className="text-[10px] leading-tight text-stone-500">{hint}</span>
    </button>
  );
}
