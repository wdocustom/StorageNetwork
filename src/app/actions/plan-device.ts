"use server";

// "Confirm it's you" for DIY plan links opened on a new device. The token
// only says which buyer; the code goes to that buyer's email. See
// @/lib/server/plan-device.

import { getServiceClient } from "@/lib/supabase-server";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import {
  sendPlanDeviceCode,
  verifyPlanDeviceCode,
  type SendCodeResult,
  type VerifyCodeResult,
} from "@/lib/server/plan-device";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID = "This link is invalid or has expired.";

async function buyerEmail(token: string): Promise<string | null> {
  if (!UUID_RE.test(token)) return null;
  const { data } = await getServiceClient()
    .from("public_plan_purchases")
    .select("email")
    .eq("access_token", token)
    .maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

async function limited(action: string, limit: number): Promise<string | null> {
  try {
    await enforceActionRateLimit({ action, limit, window: "10 m", identify: "ip" });
    return null;
  } catch (err) {
    if (err instanceof RateLimitError) return err.message;
    throw err;
  }
}

export async function requestPlanDeviceCode(token: string): Promise<SendCodeResult> {
  const slow = await limited("plan-device-code", 10);
  if (slow) return { ok: false, error: slow };
  const email = await buyerEmail(token);
  if (!email) return { ok: false, error: INVALID };
  return sendPlanDeviceCode(email);
}

export async function confirmPlanDeviceCode(token: string, code: string): Promise<VerifyCodeResult> {
  const slow = await limited("plan-device-verify", 20);
  if (slow) return { ok: false, error: slow };
  const email = await buyerEmail(token);
  if (!email) return { ok: false, error: INVALID };
  return verifyPlanDeviceCode(email, code);
}
