import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendInstallerWelcome } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe Callback — Return URL after Stripe Connect onboarding
// Verifies the account, marks onboarding complete, sends welcome email.
// ═══════════════════════════════════════════════════════════════════════════

// Lazy-initialize Supabase client to avoid build-time errors
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase environment variables not configured");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function GET(request: NextRequest) {
  const baseUrl = getAppUrl();

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
    const { data: profile } = await getSupabase()
      .from("profiles")
      .select("id, first_name, last_name, business_name")
      .eq("stripe_account_id", accountId)
      .single();

    if (!profile) {
      return NextResponse.redirect(`${baseUrl}/partner/join?error=profile_not_found`);
    }

    // 3. Mark onboarding as complete
    await getSupabase()
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
