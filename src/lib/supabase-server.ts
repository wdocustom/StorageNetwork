import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Singleton Supabase Service-Role Client (Server-Side Only)
//
// Reuses a single client instance across all server actions and API routes
// to avoid creating new HTTP connections on every request. This is critical
// during traffic spikes — Supabase has a limited connection pool.
// ═══════════════════════════════════════════════════════════════════════════

let _client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      // Build-time: env vars aren't available. Return a proxy that defers
      // the real client creation until the first actual DB call at runtime.
      return new Proxy({} as SupabaseClient, {
        get(_, prop) {
          // Re-check env vars at call time (they'll be set at runtime)
          return getServiceClient()[prop as keyof SupabaseClient];
        },
      });
    }
    _client = createClient(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    });
  }
  return _client;
}
