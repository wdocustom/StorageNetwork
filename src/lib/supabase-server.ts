import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Singleton Supabase Service-Role Client (Server-Side Only)
//
// Reuses a single client instance across all server actions and API routes
// to avoid creating new HTTP connections on every request. This is critical
// during traffic spikes — Supabase has a limited connection pool.
//
// Connection pooling: When SUPABASE_POOLER_URL is set (Supabase's PgBouncer
// endpoint), the client routes through the connection pooler to prevent
// exhausting direct Postgres connections under high concurrency.
// ═══════════════════════════════════════════════════════════════════════════

let _client: SupabaseClient | null = null;

/** Fetch wrapper with retry + exponential backoff for transient failures. */
function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const maxRetries = 3;
  const attempt = async (n: number): Promise<Response> => {
    try {
      return await fetch(input, { ...init, cache: "no-store" as RequestCache });
    } catch (err) {
      if (n >= maxRetries) throw err;
      // Exponential backoff: 200ms, 400ms, 800ms
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, n)));
      return attempt(n + 1);
    }
  };
  return attempt(0);
}

export function getServiceClient(): SupabaseClient {
  if (!_client) {
    // Prefer the pooler URL (PgBouncer) for production scalability
    const url =
      process.env.SUPABASE_POOLER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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
      db: { schema: "public" },
      global: {
        fetch: resilientFetch,
      },
    });
  }
  return _client;
}
