import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendInstallerWelcome } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe Callback — Return URL after Stripe Connect onboarding
// Verifies the account, marks onboarding complete, sends welcome email.
//
// SECURITY (C-2): the `state` URL parameter MUST match the value of the
// HTTP-only `stripe_oauth_state` cookie set by connectStripe(). This prevents
// CSRF / payout-hijacking attacks where an attacker crafts a callback URL
// pointing at their own Connected Account.
// ═══════════════════════════════════════════════════════════════════════════

// Duplicated literal (kept in sync with src/app/actions/stripe-connect.ts).
// "use server" modules cannot export non-async constants.
const STRIPE_OAUTH_STATE_COOKIE = "stripe_oauth_state";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function GET(request: NextRequest) {
  const baseUrl = getAppUrl();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const accountId = request.nextUrl.searchParams.get("account_id");
    const state = request.nextUrl.searchParams.get("state");

    // ── CSRF state validation ────────────────────────────────────────────
    // Must happen BEFORE any Stripe API call or DB write.
    const cookieStore = await cookies();
    const cookieState = cookieStore.get(STRIPE_OAUTH_STATE_COOKIE)?.value;

    if (!state || !cookieState || !safeEqual(state, cookieState)) {
      console.warn("[Stripe Callback] CSRF state mismatch — rejecting", {
        hasUrlState: Boolean(state),
        hasCookieState: Boolean(cookieState),
      });
      // Always burn the cookie on a failed attempt to prevent reuse.
      cookieStore.delete(STRIPE_OAUTH_STATE_COOKIE);
      return new NextResponse("Forbidden: invalid or missing OAuth state", {
        status: 403,
      });
    }

    if (!accountId || !stripe) {
      cookieStore.delete(STRIPE_OAUTH_STATE_COOKIE);
      return NextResponse.redirect(`${baseUrl}/partner/join?error=missing_account`);
    }

    // 1. Verify the Stripe account
    const account = await stripe.accounts.retrieve(accountId);

    if (!account || !account.details_submitted) {
      // Onboarding wasn't completed — redirect back to join page.
      // Keep the state cookie so a refresh from Stripe can still complete.
      return NextResponse.redirect(`${baseUrl}/partner/join?stripe=incomplete`);
    }

    // 2. Find the installer profile by stripe_account_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, business_name")
      .eq("stripe_account_id", accountId)
      .single();

    if (!profile) {
      cookieStore.delete(STRIPE_OAUTH_STATE_COOKIE);
      return NextResponse.redirect(`${baseUrl}/partner/join?error=profile_not_found`);
    }

    // 3. Mark onboarding as complete
    await supabase
      .from("profiles")
      .update({
        stripe_details_submitted: true,
      })
      .eq("id", profile.id);

    // 4. Send welcome email
    const installerName = [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ") || profile.business_name || "Partner";

    const installerEmail = account.email;
    if (installerEmail) {
      await sendInstallerWelcome(installerName, installerEmail);
    }

    // 5. Burn the CSRF state cookie now that the binding is complete.
    cookieStore.delete(STRIPE_OAUTH_STATE_COOKIE);

    // 6. Redirect to dashboard with welcome flag
    return NextResponse.redirect(`${baseUrl}/dashboard?welcome=true`);
  } catch (err) {
    console.error("[Stripe Callback] Error:", err);
    return NextResponse.redirect(`${baseUrl}/dashboard?stripe=error`);
  }
}
