import "server-only";

import { getServiceClient } from "@/lib/supabase-server";

// Record a paid Smart Inventory add-on (idempotent: one row per email). Used
// on the buyer's return from checkout and by the Stripe webhook, whichever
// comes first.
export async function grantDiyInventory(email: string, sessionId: string | null, amountCents: number): Promise<void> {
  const db = getServiceClient();
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  const { data: existing } = await db.from("diy_inventory_access").select("id").eq("email", clean).maybeSingle();
  if (existing) return;
  const { error } = await db
    .from("diy_inventory_access")
    .insert({ email: clean, stripe_session_id: sessionId, amount_cents: amountCents });
  // 23505: another request recorded it first — fine.
  if (error && (error as { code?: string }).code !== "23505") console.error("[DiyInventory] grant failed:", error.message);
}

export async function hasDiyInventory(email: string): Promise<boolean> {
  const { data } = await getServiceClient()
    .from("diy_inventory_access")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return !!data;
}
