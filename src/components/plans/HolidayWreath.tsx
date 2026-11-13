// ═══════════════════════════════════════════════════════════════════════════
// A little holiday wreath that hangs off the corner of a price, tilted, on a
// red ribbon, with a slow sway. Pure SVG + CSS, no client JS. Shows only
// inside HOLIDAY_WREATH_UNTIL, so it takes itself down after the season.
// ═══════════════════════════════════════════════════════════════════════════

/** Last day the wreath shows (exclusive), ISO date. */
export const HOLIDAY_WREATH_UNTIL = "2027-01-06";

export function holidayWreathOn(now = new Date()): boolean {
  return now < new Date(`${HOLIDAY_WREATH_UNTIL}T00:00:00Z`);
}

const LEAVES = 22;
const BERRIES = [20, 75, 140, 200, 255, 320];

export default function HolidayWreath({ className = "" }: { className?: string }) {
  if (!holidayWreathOn()) return null;
  return (
    <span aria-hidden className={`sn-wreath pointer-events-none select-none ${className}`}>
      <style>{`
        .sn-wreath { display: block; transform-origin: 50% 0; animation: sn-wreath-sway 4.5s ease-in-out infinite; }
        @keyframes sn-wreath-sway { 0%, 100% { transform: rotate(-16deg); } 50% { transform: rotate(-8deg); } }
        @media (prefers-reduced-motion: reduce) { .sn-wreath { animation: none; transform: rotate(-12deg); } }
      `}</style>
      <svg viewBox="0 0 100 128" className="h-full w-full overflow-visible drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]">
        {/* Ribbon it hangs from */}
        <path d="M50 0 V30" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="2" r="3" fill="#facc15" />

        {/* Evergreen ring: two layers of leaves, dark under light */}
        <g transform="translate(50 78)">
          <circle r="34" fill="none" stroke="#14532d" strokeWidth="16" />
          {Array.from({ length: LEAVES }, (_, i) => {
            const a = (360 / LEAVES) * i;
            return (
              <g key={i} transform={`rotate(${a})`}>
                <ellipse cx="0" cy="-36" rx="5.5" ry="11" fill="#166534" transform="rotate(35 0 -36)" />
                <ellipse cx="0" cy="-30" rx="4.5" ry="9" fill="#22c55e" transform="rotate(-30 0 -30)" />
              </g>
            );
          })}
          {/* Berries */}
          {BERRIES.map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <circle cx="4" cy="-34" r="3.6" fill="#ef4444" />
              <circle cx="-2" cy="-39" r="3" fill="#dc2626" />
              <circle cx="3" cy="-35" r="1" fill="#fecaca" />
            </g>
          ))}
          {/* Little gold baubles */}
          {[100, 290].map((a) => (
            <circle key={a} cx="0" cy="-34" r="3.2" fill="#facc15" transform={`rotate(${a})`} />
          ))}
          {/* Bow at the bottom */}
          <g transform="translate(0 34)">
            <path d="M-3 0 L-12 18 L-6 16 L-4 22 Z" fill="#b91c1c" />
            <path d="M3 0 L12 18 L6 16 L4 22 Z" fill="#b91c1c" />
            <path d="M0 0 C-10 -12 -22 -6 -16 4 C-12 10 -4 4 0 0 Z" fill="#ef4444" />
            <path d="M0 0 C10 -12 22 -6 16 4 C12 10 4 4 0 0 Z" fill="#ef4444" />
            <circle r="4" fill="#dc2626" />
          </g>
        </g>
      </svg>
    </span>
  );
}
