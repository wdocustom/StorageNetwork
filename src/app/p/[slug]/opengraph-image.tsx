import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic OG Image for Installer Portfolio — /p/[slug]
//
// Generates a 1200×630 branded card that Facebook, iMessage, and other
// platforms render as a rich link preview. Shows the installer's business
// name, location, and a strong CTA.
// ═══════════════════════════════════════════════════════════════════════════

export const alt = "Installer Portfolio — Storage Network";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function getProfile(slug: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name, business_name, trade_name, city, state, avatar_url")
    .ilike("slug", slug.trim())
    .single();
  return data;
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getProfile(slug);

  const businessName =
    profile?.business_name ||
    profile?.trade_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Storage Network Installer";

  const location = [profile?.city, profile?.state].filter(Boolean).join(", ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0a0e1a 0%, #080c16 50%, #0d1220 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Top-left glow */}
        <div
          style={{
            position: "absolute",
            top: -80,
            left: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(250,204,21,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Bottom-right glow */}
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(250,204,21,0.05) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            zIndex: 1,
          }}
        >
          {/* Avatar circle with initial */}
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              width={120}
              height={120}
              style={{
                borderRadius: "50%",
                border: "4px solid rgba(250,204,21,0.3)",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                border: "4px solid rgba(250,204,21,0.3)",
                background: "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                fontWeight: 900,
                color: "#64748b",
              }}
            >
              {businessName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Verified badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 999,
              padding: "6px 16px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="#34d399">
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#34d399", letterSpacing: 1 }}>
              VERIFIED INSTALLER
            </span>
          </div>

          {/* Business name */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: -1,
              textAlign: "center",
              maxWidth: 900,
              lineHeight: 1.1,
            }}
          >
            {businessName}
          </div>

          {/* Location */}
          {location && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 22,
                color: "#94a3b8",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {location}
            </div>
          )}

          {/* CTA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(250,204,21,1)",
              borderRadius: 14,
              padding: "14px 32px",
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 900, color: "#0a0e1a", letterSpacing: 1.5 }}>
              DESIGN YOUR STORAGE SYSTEM FREE
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0e1a" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>

        {/* Bottom bar — branding */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "16px 0",
            borderTop: "1px solid rgba(148,163,184,0.1)",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: "#475569", letterSpacing: 1 }}>
            storage-network.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
