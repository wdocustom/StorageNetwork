import { ImageResponse } from "next/og";
import { PLANS_PRICES } from "@/lib/schema/plans";

// ═══════════════════════════════════════════════════════════════════════════
// OG Image for the DIY plans storefront — /plans
//
// 1200×630 card for link previews: headline, tote brands, prices, and a
// 4×4 tote rack drawn in boxes (the hero photo is WebP, which next/og
// can't render).
// ═══════════════════════════════════════════════════════════════════════════

export const alt = "DIY tote rack plans for 27-gallon HDX and Greenmade totes — Storage Network";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const WOOD = "#d6b27c";

function Rack() {
  const rows = [0, 1, 2, 3];
  const cols = [0, 1, 2, 3];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 14,
        border: `10px solid ${WOOD}`,
        borderRadius: 6,
        background: "rgba(214,178,124,0.06)",
      }}
    >
      {rows.map((r) => (
        <div key={r} style={{ display: "flex", gap: 14 }}>
          {cols.map((c) => (
            <div
              key={c}
              style={{
                width: 92,
                height: 76,
                display: "flex",
                flexDirection: "column",
                borderRadius: 6,
                background: "#1f2937",
                borderTop: "12px solid #facc15",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 72px",
          background: "linear-gradient(135deg, #0a0e1a 0%, #080c16 50%, #0d1220 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 600 }}>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 3,
              color: "#facc15",
            }}
          >
            STORAGE NETWORK · DIY PLANS
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 900, color: "#ffffff", lineHeight: 1.05, letterSpacing: -1 }}>
            Tote Rack Plans, Sized to Your Wall
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#94a3b8", lineHeight: 1.3 }}>
            2×4 build for 27-gallon HDX &amp; Greenmade totes. Cut list, shopping list, every step in 3D.
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
            <div
              style={{
                display: "flex",
                background: "#facc15",
                borderRadius: 12,
                padding: "12px 24px",
                fontSize: 22,
                fontWeight: 900,
                color: "#0a0e1a",
              }}
            >
              PDF {PLANS_PRICES.pdf}
            </div>
            <div
              style={{
                display: "flex",
                border: "2px solid rgba(250,204,21,0.5)",
                borderRadius: 12,
                padding: "12px 24px",
                fontSize: 22,
                fontWeight: 900,
                color: "#facc15",
              }}
            >
              3D Guide {PLANS_PRICES.interactive}
            </div>
          </div>
        </div>
        <Rack />
      </div>
    ),
    { ...size },
  );
}
