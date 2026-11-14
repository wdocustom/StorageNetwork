import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/plans/manifest?token=… — the "My Plans" home-screen app for a plan
// buyer. The site's own manifest is the installer dashboard (start_url
// /dashboard); a buyer who adds their plans to the home screen must land on
// their plan library instead. The plan page points its <link rel=manifest>
// here (SaveToHomeScreen). The token is the buyer's own link; it is only
// echoed into start_url, never looked up.
export function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const start = /^[A-Za-z0-9-]{8,80}$/.test(token)
    ? `/plans/library?token=${encodeURIComponent(token)}&from=homescreen`
    : "/plans";
  const manifest = {
    id: "/plans/my-plans",
    name: "My Tote Rack Plans",
    short_name: "My Plans",
    description: "Your Storage Network build plans: 3D guide, cut list and PDF.",
    start_url: start,
    scope: "/plans/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, no-store" },
  });
}
