import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Auth Callback — Supabase email confirmation & password recovery
//
// CRITICAL: must use `createServerClient` from `@supabase/ssr` so the
// session it produces lands in the response as HttpOnly cookies. The
// previous version used the plain `@supabase/supabase-js` client, which
// has no cookie integration — the session lived in the route handler's
// memory, then evaporated on redirect. Downstream pages (/reset-password,
// /dashboard) saw an unauthenticated browser and rendered "Link Expired".
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "recovery"
    | "signup"
    | "invite"
    | "magiclink"
    | "email_change"
    | "email"
    | null;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    }
  );

  // ── PKCE flow (modern Supabase default): ?code=... ────────────────────
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }

    if (data?.user?.id) {
      const serviceClient = getServiceClient();
      await serviceClient
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", data.user.id);
    }

    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // ── OTP flow (older Supabase config): ?token_hash=...&type=... ────────
  // The previous version stuffed token_hash into a fake URL fragment and
  // hoped the destination page would parse it. That never worked — a
  // token_hash is NOT an access_token and the reset page was trying to
  // call setSession with it. Use verifyOtp explicitly so we end up with
  // a real session (in cookies, courtesy of the SSR client above).
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      console.error(
        `[auth/callback] verifyOtp(type=${type}) failed:`,
        error.message
      );
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }

    if (data?.user?.id) {
      const serviceClient = getServiceClient();
      await serviceClient
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", data.user.id);
    }

    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
