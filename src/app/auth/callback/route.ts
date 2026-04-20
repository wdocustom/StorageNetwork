import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Auth Callback — Handles Supabase email confirmation & password recovery
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (code) {
    // PKCE flow — exchange code for session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Stamp login for the authenticated user
    if (data?.user?.id) {
      const serviceClient = getServiceClient();
      await serviceClient
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", data.user.id);
    }

    // Redirect to reset-password page for recovery flow, dashboard otherwise
    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  if (token_hash && type) {
    // Password recovery flow — redirect to reset password page
    if (type === "recovery") {
      return NextResponse.redirect(
        `${origin}/reset-password#access_token=${token_hash}&type=${type}`
      );
    }
    // Magic link / email confirmation flow
    return NextResponse.redirect(
      `${origin}/dashboard#access_token=${token_hash}&type=${type}`
    );
  }

  // Fallback — redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
