import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * The signed-in user from the local session cookie — no round trip to the
 * Auth server (getUser() makes one). For dashboard pages, whose session the
 * middleware has already verified; reads stay protected by RLS. A session
 * whose access token has expired is refreshed first.
 */
export async function getSessionUser(client = getSupabaseBrowserClient()) {
  const {
    data: { session },
  } = await client.auth.getSession();
  return session?.user ?? null;
}
