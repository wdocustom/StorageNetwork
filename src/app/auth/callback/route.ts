import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// Auth Callback — Handles Supabase email confirmation redirects
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

    await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  if (token_hash && type) {
    // Magic link / email confirmation flow
    return NextResponse.redirect(
      `${origin}/dashboard#access_token=${token_hash}&type=${type}`
    );
  }

  // Fallback — redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
