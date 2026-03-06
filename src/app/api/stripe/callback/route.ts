import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendInstallerWelcome } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe Callback — Return URL after Stripe Connect onboarding
// Verifies the account, marks onboarding complete, sends welcome email.
// ═══════════════════════════════════════════════════════════════════════════

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function GET(request: NextRequest) {
  const baseUrl = getAppUrl();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const accountId = request.nextUrl.searchParams.get("account_id");

    if (!accountId || !stripe) {
      return NextResponse.redirect(`${baseUrl}/partner/join?error=missing_account`);
    }

    // 1. Verify the Stripe account
    const account = await stripe.accounts.retrieve(accountId);

    if (!account || !account.details_submitted) {
      // Onboarding wasn't completed — redirect back to join page
      return NextResponse.redirect(`${baseUrl}/partner/join?stripe=incomplete`);
    }

    // 2. Find the installer profile by stripe_account_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, business_name")
      .eq("stripe_account_id", accountId)
      .single();

    if (!profile) {
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

    // 5. Redirect to dashboard with welcome flag
    return NextResponse.redirect(`${baseUrl}/dashboard?welcome=true`);
  } catch (err) {
    console.error("[Stripe Callback] Error:", err);
    return NextResponse.redirect(`${baseUrl}/dashboard?stripe=error`);
  }
}
