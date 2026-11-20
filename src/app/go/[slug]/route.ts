import { NextRequest, NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// Short links for videos and posts: storage-network.app/go/<name>
//
// Opens the plans designer tagged with the video's name
// (utm_source=video, utm_medium=organic, utm_campaign=<name>) so the Plans
// tab can show which video brings designers and buyers. ?to=plans lands on
// the /plans page instead of the designer. Names: letters, digits, - and _.
// Names in DESIGNS also open the designer on that rack.
// ═══════════════════════════════════════════════════════════════════════════

/** Short link name → the design it opens (compact form, see tote-plans.ts) */
const DESIGNS: Record<string, string> = {
  // Mini challenge video: a 9 wide × 13 tall Mini Tote Rack with a top
  "mini-challenge": "M9x13t",
};

export function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const name = slug.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "video";
    const dest = req.nextUrl.searchParams.get("to") === "plans" ? "/plans" : "/plans/checkout";
    const url = new URL(dest, req.nextUrl.origin);
    const design = DESIGNS[name];
    if (design && dest === "/plans/checkout") url.searchParams.set("design", design);
    url.searchParams.set("utm_source", "video");
    url.searchParams.set("utm_medium", "organic");
    url.searchParams.set("utm_campaign", name);
    // Keep Facebook's click id if present (attribution once the pixel is on)
    const fbclid = req.nextUrl.searchParams.get("fbclid");
    if (fbclid) url.searchParams.set("fbclid", fbclid);
    return NextResponse.redirect(url, 302);
  });
}
