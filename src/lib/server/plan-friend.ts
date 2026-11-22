import "server-only";

import { randomInt } from "crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { cleanFriendCode } from "@/lib/plan-friend";
import { publicName } from "@/lib/reviews";

// Friend codes: one per buyer email (plan_friend_codes). See @/lib/plan-friend.

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i

function newCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** The buyer's share code, created on first use. Null if it can't be saved. */
export async function getOrCreateFriendCode(rawEmail: string, purchaseId: string | null): Promise<string | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;
  const db = getServiceClient();
  const { data: existing } = await db.from("plan_friend_codes").select("code").eq("email", email).maybeSingle();
  if (existing?.code) return existing.code as string;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { error } = await db.from("plan_friend_codes").insert({ code, email, purchase_id: purchaseId });
    if (!error) return code;
    // Another run made this buyer's code first: use it.
    if (error.code === "23505") {
      const { data } = await db.from("plan_friend_codes").select("code").eq("email", email).maybeSingle();
      if (data?.code) return data.code as string;
      continue; // code collision: try another
    }
    console.error("[PlanFriend] couldn't save a code:", error.message);
    return null;
  }
  return null;
}

/** Who shared a code: { code, email, name: "Doug H." }, or null if unknown. */
export async function resolveFriendCode(raw: unknown): Promise<{ code: string; email: string; name: string } | null> {
  const code = cleanFriendCode(raw);
  if (!code) return null;
  const db = getServiceClient();
  const { data } = await db.from("plan_friend_codes").select("code, email, purchase_id").eq("code", code).maybeSingle();
  if (!data) return null;
  let name = "A friend";
  if (data.purchase_id) {
    const { data: p } = await db.from("public_plan_purchases").select("customer_name").eq("id", data.purchase_id).maybeSingle();
    name = publicName(p?.customer_name as string | null, "A friend");
  }
  return { code, email: data.email as string, name };
}
