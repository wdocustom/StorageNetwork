"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { MapPin, ExternalLink, Shield, ChevronRight } from "lucide-react";
import type { MapInstaller } from "@/app/actions/installer-map";
import {
  projectPoint,
  milesToPixels,
  US_CITIES,
} from "@/lib/us-map-projection";
import {
  US_VIEWBOX,
  STATE_PATHS,
  STATE_BORDERS,
  NATION_OUTLINE,
} from "@/lib/us-states-data";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Network Map — Interactive SVG US Map
//
// Pure SVG, zero mapping library dependencies. State boundaries are
// pre-projected Albers USA paths generated from us-atlas topojson.
// Installer pins are geocoded server-side from ZIP codes.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  installers: MapInstaller[];
}

const { width: W, height: H } = US_VIEWBOX;

export default function InstallerNetworkMap({ installers }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Project installer positions
  const pins = useMemo(() => {
    return installers.map((inst) => {
      const pt = projectPoint(inst.lng, inst.lat, W, H);
      if (!pt) return null;
      const radius = milesToPixels(inst.radiusMiles, inst.lat, W);
      return { ...inst, x: pt[0], y: pt[1], r: Math.max(radius, 8) };
    }).filter(Boolean) as (MapInstaller & { x: number; y: number; r: number })[];
  }, [installers]);

  // Project city labels
  const cityLabels = useMemo(() => {
    return US_CITIES.map((city) => {
      const pt = projectPoint(city.lng, city.lat, W, H);
      if (!pt) return null;
      return { ...city, x: pt[0], y: pt[1] };
    }).filter(Boolean) as (typeof US_CITIES[number] & { x: number; y: number })[];
  }, []);

  const activeInstaller = selectedId
    ? pins.find((p) => p.id === selectedId)
    : hoveredId
      ? pins.find((p) => p.id === hoveredId)
      : null;

  // Track tooltip position relative to SVG
  const handlePinHover = useCallback(
    (id: string, e: React.MouseEvent) => {
      setHoveredId(id);
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    },
    [],
  );

  const handlePinClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  // Close selected on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        svgRef.current &&
        !svgRef.current.contains(e.target as Node)
      ) {
        setSelectedId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      {/* ── SVG Map ──────────────────────────────────────────────────── */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        style={{ maxHeight: "70vh" }}
      >
        <defs>
          {/* Gradient for service radius circles */}
          <radialGradient id="radius-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#facc15" stopOpacity="0.25" />
            <stop offset="70%" stopColor="#facc15" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="radius-glow-hover" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#facc15" stopOpacity="0.4" />
            <stop offset="70%" stopColor="#facc15" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
          </radialGradient>
          {/* Subtle vignette overlay */}
          <radialGradient id="map-vignette" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.4" />
          </radialGradient>
          {/* Pin glow filter */}
          <filter id="pin-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>

        {/* ── State Fills ─────────────────────────────────────────── */}
        <g>
          {Object.entries(STATE_PATHS).map(([abbr, d]) => (
            <path
              key={abbr}
              d={d}
              fill="#0f172a"
              stroke="none"
              className="transition-colors duration-300"
            />
          ))}
        </g>

        {/* ── State Borders ───────────────────────────────────────── */}
        <path
          d={STATE_BORDERS}
          fill="none"
          stroke="#1e293b"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* ── Nation Outline ──────────────────────────────────────── */}
        <path
          d={NATION_OUTLINE}
          fill="none"
          stroke="#334155"
          strokeWidth="1"
          strokeLinejoin="round"
        />

        {/* ── Service Radius Circles ──────────────────────────────── */}
        <g>
          {pins.map((pin) => (
            <circle
              key={`radius-${pin.id}`}
              cx={pin.x}
              cy={pin.y}
              r={pin.r}
              fill={
                activeInstaller?.id === pin.id
                  ? "url(#radius-glow-hover)"
                  : "url(#radius-glow)"
              }
              stroke={
                activeInstaller?.id === pin.id
                  ? "rgba(250,204,21,0.4)"
                  : "rgba(250,204,21,0.1)"
              }
              strokeWidth={activeInstaller?.id === pin.id ? 1 : 0.5}
              className="transition-all duration-300"
            />
          ))}
        </g>

        {/* ── City Labels ─────────────────────────────────────────── */}
        <g>
          {cityLabels.map((city) => {
            const isMajor = city.size === "major";
            const isMedium = city.size === "medium";
            return (
              <g key={city.name}>
                {/* City dot */}
                <circle
                  cx={city.x}
                  cy={city.y}
                  r={isMajor ? 2 : isMedium ? 1.5 : 1}
                  fill={isMajor ? "#64748b" : "#475569"}
                  opacity={isMajor ? 0.8 : 0.5}
                />
                {/* City name */}
                <text
                  x={city.x + 4}
                  y={city.y + 1}
                  fontSize={isMajor ? 7 : isMedium ? 6 : 5}
                  fill={isMajor ? "#94a3b8" : "#64748b"}
                  fontFamily="Inter, system-ui, sans-serif"
                  opacity={isMajor ? 0.9 : isMedium ? 0.7 : 0.5}
                >
                  {city.name}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Installer Pins ──────────────────────────────────────── */}
        <g>
          {pins.map((pin) => {
            const isActive = activeInstaller?.id === pin.id;
            return (
              <g
                key={`pin-${pin.id}`}
                className="cursor-pointer"
                onMouseEnter={(e) => handlePinHover(pin.id, e)}
                onMouseLeave={() => { if (!selectedId) setHoveredId(null); }}
                onClick={() => handlePinClick(pin.id)}
              >
                {/* Outer glow ring */}
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={isActive ? 8 : 6}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth={isActive ? 2 : 1}
                  opacity={isActive ? 0.8 : 0.4}
                  filter="url(#pin-glow)"
                  className="transition-all duration-200"
                />
                {/* Inner pin */}
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={isActive ? 5 : 3.5}
                  fill={pin.isPro ? "#facc15" : "#94a3b8"}
                  stroke="#020617"
                  strokeWidth="1.5"
                  className="transition-all duration-200"
                />
                {/* Pulse animation for active */}
                {isActive && (
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r="5"
                    fill="none"
                    stroke="#facc15"
                    strokeWidth="1.5"
                    opacity="0"
                  >
                    <animate
                      attributeName="r"
                      from="5"
                      to="18"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.6"
                      to="0"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </g>

        {/* Vignette overlay */}
        <rect width={W} height={H} fill="url(#map-vignette)" pointerEvents="none" />
      </svg>

      {/* ── Tooltip ──────────────────────────────────────────────── */}
      {activeInstaller && tooltipPos && (
        <div
          ref={tooltipRef}
          className="pointer-events-auto absolute z-20 min-w-[200px] max-w-[260px] rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-md"
          style={{
            left: Math.min(tooltipPos.x + 12, (svgRef.current?.clientWidth ?? W) - 270),
            top: tooltipPos.y - 10,
            transform: "translateY(-100%)",
          }}
        >
          <div className="flex items-start gap-2.5">
            {/* Avatar or icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-slate-700">
              {activeInstaller.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeInstaller.avatarUrl}
                  alt=""
                  className="h-9 w-9 rounded-lg object-cover"
                />
              ) : (
                <MapPin className="h-4 w-4 text-yellow-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-bold text-white">
                  {activeInstaller.name}
                </p>
                {activeInstaller.isPro && (
                  <Shield className="h-3 w-3 shrink-0 text-yellow-400" />
                )}
              </div>
              <p className="text-[11px] text-stone-400">
                {[activeInstaller.city, activeInstaller.state]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="mt-0.5 text-[10px] text-stone-500">
                {activeInstaller.radiusMiles} mi service radius
              </p>
            </div>
          </div>

          {/* CTA */}
          {activeInstaller.slug && (
            <a
              href={`/p/${activeInstaller.slug}`}
              className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-yellow-400/10 px-3 py-1.5 text-[11px] font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
            >
              View Profile
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[10px] text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" />
          Pro Installer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />
          Network Installer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-yellow-400/30 bg-yellow-400/10" />
          Service Area
        </span>
      </div>

      {/* ── Installer List (mobile-friendly, below map) ──────────── */}
      {pins.length > 0 && (
        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pins.map((pin) => (
            <a
              key={`card-${pin.id}`}
              href={pin.slug ? `/p/${pin.slug}` : undefined}
              className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 transition-all hover:border-yellow-400/30 hover:bg-slate-800/60"
              onMouseEnter={() => setHoveredId(pin.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-slate-700">
                {pin.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pin.avatarUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <MapPin className="h-3.5 w-3.5 text-yellow-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-xs font-bold text-white">{pin.name}</p>
                  {pin.isPro && <Shield className="h-2.5 w-2.5 shrink-0 text-yellow-400" />}
                </div>
                <p className="text-[10px] text-stone-500">
                  {[pin.city, pin.state].filter(Boolean).join(", ")}
                  {" · "}
                  {pin.radiusMiles} mi
                </p>
              </div>
              {pin.slug && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-600 transition-colors group-hover:text-yellow-400" />
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
