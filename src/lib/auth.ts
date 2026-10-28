"use server";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// ═══════════════════════════════════════════════════════════════════════════
// Server-Side Auth — Verifies the calling user's identity
//
// Uses the ANON key + the user's cookie-based session (not the service role).
// This ensures server actions validate that the caller is who they claim to be.
// ═══════════════════════════════════════════════════════════════════════════

export async function getAuthenticatedUser(): Promise<{
  id: string;
  email?: string;
} | null> {
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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component context — cookies are read-only
          }
        },
      },
    }
  );

  // getClaims verifies the session JWT against the project's signing keys
  // (locally, once the keys are cached) instead of a round trip to the Auth
  // server per call; on a symmetric-key project it falls back to getUser().
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: claims.email };
}

/**
 * Verify that the authenticated user owns the given lead.
 * Returns the user ID if authorized, null otherwise.
 */
export async function verifyLeadOwnership(
  leadId: string
): Promise<string | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  // Use service client to check lead ownership (RLS doesn't apply to service role)
  const { getServiceClient } = await import("@/lib/supabase-server");
  const db = getServiceClient();

  const { data: lead } = await db
    .from("leads")
    .select("installer_id")
    .eq("id", leadId)
    .single();

  if (!lead || lead.installer_id !== user.id) return null;
  return user.id;
}
