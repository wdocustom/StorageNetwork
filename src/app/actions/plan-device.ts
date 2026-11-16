"use server";

// "Confirm it's you" for DIY plan links opened on a new device. The token
// only says which buyer; the code goes to that buyer's email. See
// @/lib/server/plan-device.

import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import {
  sendPlanDeviceCode,
  verifyPlanDeviceCode,
  type SendCodeResult,
  type VerifyCodeResult,
} from "@/lib/server/plan-device";
import { activityOwnerByToken, recordPlanActivity } from "@/lib/server/plan-activity";

const INVALID = "This link is invalid or has expired.";

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
  const owner = await activityOwnerByToken(token);
  if (!owner) return { ok: false, error: INVALID };
  const res = await sendPlanDeviceCode(owner.email);
  if (res.ok) await recordPlanActivity(owner, "code_sent");
  return res;
}

export async function confirmPlanDeviceCode(token: string, code: string): Promise<VerifyCodeResult> {
  const slow = await limited("plan-device-verify", 20);
  if (slow) return { ok: false, error: slow };
  const owner = await activityOwnerByToken(token);
  if (!owner) return { ok: false, error: INVALID };
  const res = await verifyPlanDeviceCode(owner.email, code);
  await recordPlanActivity(owner, res.ok ? "code_verified" : "code_rejected");
  return res;
}
