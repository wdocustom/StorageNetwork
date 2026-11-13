// ═══════════════════════════════════════════════════════════════════════════
// A holiday wreath hooked over the top of a price's last digit, hanging down
// its side at a slant. Drawn as SVG: a few hundred pine needles in layered
// greens (deterministic, so server and client agree), glossy berries, pine
// cones and a satin ribbon that loops over the digit. Gentle sway from the
// hook; still for reduced-motion users. No client JS. Shows only before
// HOLIDAY_WREATH_UNTIL, so it takes itself down after the season.
// ═══════════════════════════════════════════════════════════════════════════

/** First day the wreath no longer shows, ISO date. */
export const HOLIDAY_WREATH_UNTIL = "2027-01-06";

export function holidayWreathOn(now = new Date()): boolean {
  return now < new Date(`${HOLIDAY_WREATH_UNTIL}T00:00:00Z`);
}

// Small seeded PRNG so the foliage is identical on every render.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CX = 50;
const CY = 58;
const R = 27;

interface Needle {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  c: string;
  w: number;
}

/** Pine needles in three passes: deep shadow, body, sunlit tips. */
function foliage(): Needle[][] {
  const rand = rng(1225);
  const passes = [
    { n: 160, spread: 9, len: [7, 11], w: 1.6, colors: ["#0b2e17", "#0f3a1d", "#123f22"] },
    { n: 230, spread: 8, len: [6, 10], w: 1.25, colors: ["#14532d", "#17602f", "#1b6a36", "#1f5f34"] },
    { n: 150, spread: 7, len: [4, 7], w: 0.9, colors: ["#2f7d46", "#3b8f52", "#4a9d5c", "#5aa86a"] },
  ];
  return passes.map((p) =>
    Array.from({ length: p.n }, () => {
      const a = rand() * Math.PI * 2;
      const r = R + (rand() - 0.5) * p.spread * 2;
      const x = CX + Math.cos(a) * r;
      const y = CY + Math.sin(a) * r;
      // Needles fan out mostly along the ring, a little outward
      const dir = a + Math.PI / 2 + (rand() - 0.5) * 2.2;
      const len = p.len[0] + rand() * (p.len[1] - p.len[0]);
      return {
        x1: x,
        y1: y,
        x2: x + Math.cos(dir) * len,
        y2: y + Math.sin(dir) * len,
        c: p.colors[Math.floor(rand() * p.colors.length)],
        w: p.w,
      };
    }),
  );
}

const NEEDLES = foliage();
const at = (deg: number, r = R) => ({
  x: CX + Math.cos((deg * Math.PI) / 180) * r,
  y: CY + Math.sin((deg * Math.PI) / 180) * r,
});
const BERRY_SPOTS = [25, 70, 150, 205, 300].map((d, i) => ({ ...at(d, R + (i % 2 ? 3 : -2)), k: d }));
const CONES = [{ ...at(115, R + 1), rot: 30 }, { ...at(340, R - 1), rot: -60 }];

export default function HolidayWreath({ className = "" }: { className?: string }) {
  if (!holidayWreathOn()) return null;
  return (
    <span aria-hidden className={`sn-wreath pointer-events-none select-none ${className}`}>
      <style>{`
        .sn-wreath { display: block; transform-origin: 50% 6%; animation: sn-wreath-sway 5s ease-in-out infinite; }
        @keyframes sn-wreath-sway { 0%, 100% { transform: rotate(-27deg); } 50% { transform: rotate(-21deg); } }
        @media (prefers-reduced-motion: reduce) { .sn-wreath { animation: none; transform: rotate(-24deg); } }
      `}</style>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full overflow-visible"
        style={{ filter: "drop-shadow(2px 4px 3px rgba(0,0,0,0.55))" }}
      >
        <defs>
          <radialGradient id="snw-berry" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ff7b7b" />
            <stop offset="45%" stopColor="#d81e1e" />
            <stop offset="100%" stopColor="#6e0b0b" />
          </radialGradient>
          <linearGradient id="snw-satin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b3122b" />
            <stop offset="40%" stopColor="#e5304a" />
            <stop offset="60%" stopColor="#c01a33" />
            <stop offset="100%" stopColor="#6d0a18" />
          </linearGradient>
          <linearGradient id="snw-satin-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9f1027" />
            <stop offset="100%" stopColor="#5a0814" />
          </linearGradient>
          <radialGradient id="snw-cone" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#a8743f" />
            <stop offset="100%" stopColor="#4a2c12" />
          </radialGradient>
          <radialGradient id="snw-shade" cx="50%" cy="58%" r="50%">
            <stop offset="45%" stopColor="#000" stopOpacity="0" />
            <stop offset="62%" stopColor="#000" stopOpacity="0.25" />
            <stop offset="72%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ribbon hanger looped over the top of the digit */}
        <path d="M44 33 C40 18 43 4 50 2 C57 4 60 18 56 33" fill="none" stroke="url(#snw-satin-dark)" strokeWidth="5" strokeLinecap="round" />
        <path d="M45.5 31 C42.5 18 45 7 50 5" fill="none" stroke="#f0607a" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />

        {/* Base so no background shows through gaps */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#0c3119" strokeWidth="13" />

        {NEEDLES.map((pass, i) => (
          <g key={i} strokeLinecap="round">
            {pass.map((n, j) => (
              <line key={j} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={n.c} strokeWidth={n.w} />
            ))}
          </g>
        ))}

        {/* Depth: a soft shadow band through the middle of the ring */}
        <circle cx={CX} cy={CY} r={R + 12} fill="url(#snw-shade)" />

        {/* Pine cones */}
        {CONES.map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}>
            <ellipse rx="3.4" ry="5.2" fill="url(#snw-cone)" />
            {[-2.6, -0.6, 1.4, 3.2].map((y) => (
              <path key={y} d={`M-3 ${y} Q0 ${y + 1.6} 3 ${y}`} fill="none" stroke="#3a210c" strokeWidth="0.6" />
            ))}
          </g>
        ))}

        {/* Berry clusters */}
        {BERRY_SPOTS.map((b) => (
          <g key={b.k} transform={`translate(${b.x} ${b.y})`}>
            {[
              [0, 0, 2.6],
              [3.2, 1.4, 2.2],
              [0.8, 3.4, 2.1],
            ].map(([x, y, r], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r={r} fill="url(#snw-berry)" />
                <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.28} fill="#fff" fillOpacity="0.75" />
              </g>
            ))}
          </g>
        ))}

        {/* Satin bow at the top, where the hanger meets the wreath */}
        <g transform="translate(50 33)">
          <path d="M-2 2 C-5 10 -9 17 -12 23 L-7 21 L-5 26 C-2 18 0 10 1 3 Z" fill="url(#snw-satin-dark)" />
          <path d="M2 2 C5 10 8 16 11 22 L6 20.5 L5 25 C2 17 0 10 -1 3 Z" fill="url(#snw-satin)" />
          <path d="M0 0 C-6 -9 -17 -8 -15 -1 C-13 5 -5 4 0 0 Z" fill="url(#snw-satin)" />
          <path d="M0 0 C6 -9 17 -8 15 -1 C13 5 5 4 0 0 Z" fill="url(#snw-satin)" />
          <path d="M-12 -3 C-9 -6 -5 -5 -2 -1" fill="none" stroke="#ff8fa3" strokeOpacity="0.6" strokeWidth="0.8" />
          <path d="M12 -3 C9 -6 5 -5 2 -1" fill="none" stroke="#7a0b1c" strokeOpacity="0.6" strokeWidth="0.8" />
          <ellipse rx="3.4" ry="3" fill="url(#snw-satin-dark)" />
          <ellipse cx="-0.8" cy="-0.9" rx="1.2" ry="0.8" fill="#ff9aac" fillOpacity="0.5" />
        </g>
      </svg>
    </span>
  );
}
