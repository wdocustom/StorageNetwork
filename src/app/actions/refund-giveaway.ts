"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Holiday Full Refund Giveaway — free (no purchase necessary) entry.
//
// One entry per email per Central Time day (unique index), only while the
// promotion is running, rate-limited per IP, and a hidden honeypot field
// that people never fill in. See @/lib/refund-giveaway and /refund-rules.
// ═══════════════════════════════════════════════════════════════════════════

import { headers } from "next/headers";
import { getServiceClient } from "@/lib/supabase-server";
import { getClientIp } from "@/lib/request-meta";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { centralDate, giveawayStatus } from "@/lib/refund-giveaway";

export type FreeEntryResult =
  | { ok: true; entryDate: string }
  | { ok: false; error: string; field?: "name" | "email" };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export async function submitFreeEntry(input: { name?: unknown; email?: unknown; website?: unknown }): Promise<FreeEntryResult> {
  try {
    await enforceActionRateLimit({ action: "refund-giveaway-free-entry", limit: 5, window: "10 m", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const status = giveawayStatus();
  if (status !== "active") {
    return {
      ok: false,
      error: status === "ended" ? "The promotion has ended." : "Free entry opens when the promotion starts.",
    };
  }

  const name =
    typeof input.name === "string"
      ? input.name
          // eslint-disable-next-line no-control-regex
          .replace(/[\u0000-\u001f\u007f<>]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 100)
      : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (name.split(" ").filter(Boolean).length < 2) return { ok: false, error: "Enter your full name (first and last).", field: "name" };
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address.", field: "email" };

  const entryDate = centralDate();
  // Bots fill every field; people never see this one. Look successful, store nothing.
  if (typeof input.website === "string" && input.website.trim()) return { ok: true, entryDate };

  try {
    const h = await headers();
    const { error } = await getServiceClient()
      .from("refund_giveaway_free_entries")
      .insert({
        entry_date: entryDate,
        full_name: name,
        email,
        ip: getClientIp(h),
        user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
      });
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, error: "You've already entered today. You can enter again tomorrow (Central Time)." };
      }
      console.error("[RefundGiveaway] free entry insert failed:", error.message);
      return { ok: false, error: "We couldn't record your entry. Please try again." };
    }
    return { ok: true, entryDate };
  } catch (err) {
    console.error("[RefundGiveaway] free entry failed:", err);
    return { ok: false, error: "We couldn't record your entry. Please try again." };
  }
}
