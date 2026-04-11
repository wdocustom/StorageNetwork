import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// ═══════════════════════════════════════════════════════════════════════════
// Client-Side Activity Logging
//
// Uses the browser Supabase client (localStorage-based auth) instead of
// server actions (cookie-based auth). This avoids the issue where server
// action cookie auth silently fails when session tokens aren't refreshed
// by middleware.
//
// RLS on installer_activity_log enforces: auth.uid() = installer_id
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log an installer activity from a client component.
 * Uses the browser Supabase client — auth is via localStorage, not cookies.
 * Fire-and-forget: errors are logged but never thrown.
 */
export function logActivityClient(input: {
  action: string;
  pagePath?: string;
  detail?: Record<string, unknown>;
}): void {
  const supabase = getSupabaseBrowserClient();

  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;

    supabase
      .from("installer_activity_log")
      .insert({
        installer_id: user.id,
        action: input.action,
        page_path: input.pagePath || null,
        detail: input.detail || {},
      })
      .then(({ error }) => {
        if (error) {
          console.error("[ActivityClient] Insert failed:", error.message);
        }
      });
  });
}
