import { NextRequest, NextResponse } from "next/server";
import { recordInviteClick } from "@/app/actions/affiliate-invites";

// ═══════════════════════════════════════════════════════════════════════════
// Affiliate Invite Click — /join/i/[token]
//
// Entry point for cold-email invite links. When a prospect clicks the URL
// from the affiliate's "via Storage Network" email:
//   1. Look up the invite by token. Skip silently if not found (don't
//      leak whether a token exists; just send to /partner/join).
//   2. Record the click (status → 'clicked', clicked_at = now).
//   3. Set the sn_affiliate_invite cookie (90 days) so signup-flow
//      attribution can read it even if the prospect closes the tab and
//      comes back later. This is the long-tail attribution that the
//      cookie pattern in /join/[slug] doesn't quite cover (30 days).
//   4. Redirect to /partner/join. The signup form looks the same as any
//      other affiliate signup; only the cookie differentiates the flow.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let recorded: Awaited<ReturnType<typeof recordInviteClick>> = { invite: null };
  try {
    recorded = await recordInviteClick(token);
  } catch (err) {
    // Click recording is non-fatal — we still want to redirect the prospect
    // so the page renders. Worst case the click stat is missing.
    console.warn("[InviteClick] recordInviteClick failed:", err);
  }

  const redirectUrl = new URL("/partner/join", request.url);
  const response = NextResponse.redirect(redirectUrl);

  if (recorded.invite) {
    // 90-day cookie per architecture decision 3 — longer than the
    // existing 30-day partner-slug cookie because installer-recruitment
    // cycles are slower than customer ones.
    response.cookies.set({
      name: "sn_affiliate_invite",
      value: token,
      maxAge: 60 * 60 * 24 * 90, // 90 days
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  return response;
}
