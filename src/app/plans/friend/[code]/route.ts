import { NextRequest, NextResponse } from "next/server";
import { cleanFriendCode } from "@/lib/plan-friend";

// storage-network.app/plans/friend/<code> — a plan buyer's share link. Opens
// the designer with their code; the checkout checks it and takes $3 off.
// Unknown or malformed codes still land on the designer, at the regular price.
export function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return params.then(({ code }) => {
    const url = new URL("/plans/checkout", req.nextUrl.origin);
    const clean = cleanFriendCode(code);
    if (clean) url.searchParams.set("friend", clean);
    url.searchParams.set("utm_source", "friend");
    url.searchParams.set("utm_medium", "referral");
    return NextResponse.redirect(url, 302);
  });
}
