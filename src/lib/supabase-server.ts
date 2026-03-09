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
      // During build, env vars may not be available. Return a dummy client
      // that will throw at runtime if actually used.
      return new Proxy({} as SupabaseClient, {
        get: () => {
          throw new Error("Supabase client is not available — missing env vars");
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
