import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Idempotency-Key claims for replayed client actions (native offline queue).
//
// Backed by public.idempotency_keys (migration 143). This is a *second*
// line of defense: the actions are also state-guarded, so a replay is safe
// even if the table has not been migrated yet — in that case claim() fails
// open and the state guard does the work.
// ═══════════════════════════════════════════════════════════════════════════

/** Returns true if this (user, key) is new and now claimed; false if already seen. */
export async function claimIdempotencyKey(
  userId: string,
  key: string | undefined,
  action: string
): Promise<boolean> {
  if (!key || key.length > 128) return true;
  try {
    const { error } = await getServiceClient()
      .from("idempotency_keys")
      .insert({ user_id: userId, key, action });
    if (!error) return true;
    if (error.code === "23505") return false; // unique violation → replay
    console.warn("[idempotency] claim failed open:", error.message);
    return true;
  } catch (err) {
    console.warn("[idempotency] claim failed open:", err);
    return true;
  }
}
